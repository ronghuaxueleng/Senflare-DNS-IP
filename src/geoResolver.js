const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');
const { countryMapping } = require('../config/config');

// 全局缓存变量
let regionCache = {};

/**
 * 加载地区缓存文件到内存
 */
async function loadRegionCache() {
  const cacheFile = path.join(process.cwd(), 'data', 'Cache-nodejs.json');

  if (await fs.pathExists(cacheFile)) {
    try {
      const cacheData = await fs.readJson(cacheFile, { encoding: 'utf8' });
      regionCache = cacheData;
      logger.infoWithEmoji(`📦 成功加载缓存文件，包含 ${Object.keys(regionCache).length} 个条目`);
    } catch (error) {
      logger.warning(`⚠️ 加载缓存文件失败: ${error.message}`);
      regionCache = {};
    }
  } else {
    logger.infoWithEmoji("📦 缓存文件不存在，使用空缓存");
    regionCache = {};
  }
}

/**
 * 保存地区缓存到文件
 */
async function saveRegionCache() {
  const cacheFile = path.join(process.cwd(), 'data', 'Cache-nodejs.json');

  try {
    await fs.writeJson(cacheFile, regionCache, { encoding: 'utf8', spaces: 2 });
    logger.infoWithEmoji(`💾 成功保存缓存文件，包含 ${Object.keys(regionCache).length} 个条目`);
  } catch (error) {
    logger.error(`❌ 保存缓存文件失败: ${error.message}`);
  }
}

/**
 * 检查缓存是否在有效期内
 * @param {string} timestamp - 时间戳字符串
 * @param {number} ttlHours - 有效期（小时）
 * @returns {boolean} 是否有效
 */
function isCacheValid(timestamp, ttlHours = 24) {
  if (!timestamp) return false;

  const cacheTime = new Date(timestamp);
  const now = new Date();
  const diffHours = (now - cacheTime) / (1000 * 60 * 60);

  return diffHours < ttlHours;
}

/**
 * 清理过期缓存条目并限制缓存大小，防止内存溢出
 * @param {number} ttlHours - 缓存有效期（小时）
 */
function cleanExpiredCache(ttlHours = 168) {
  const currentTime = new Date();
  const expiredKeys = [];

  // 清理过期缓存
  for (const [ip, data] of Object.entries(regionCache)) {
    if (data && typeof data === 'object' && data.timestamp) {
      const cacheTime = new Date(data.timestamp);
      const diffHours = (currentTime - cacheTime) / (1000 * 60 * 60);

      if (diffHours >= ttlHours) {
        expiredKeys.push(ip);
      }
    }
  }

  for (const key of expiredKeys) {
    delete regionCache[key];
  }

  // 限制缓存大小（最多保留1000个条目）
  const cacheSize = Object.keys(regionCache).length;
  if (cacheSize > 1000) {
    // 按时间排序，删除最旧的条目
    const sortedEntries = Object.entries(regionCache).sort((a, b) => {
      const timeA = a[1]?.timestamp || '';
      const timeB = b[1]?.timestamp || '';
      return timeA.localeCompare(timeB);
    });

    const itemsToRemove = cacheSize - 1000;
    for (let i = 0; i < itemsToRemove; i++) {
      delete regionCache[sortedEntries[i][0]];
    }
    logger.infoWithEmoji(`缓存过大，清理了 ${itemsToRemove} 个旧条目`);
  }

  if (expiredKeys.length > 0) {
    logger.infoWithEmoji(`清理了 ${expiredKeys.length} 个过期缓存条目`);
  }
}

/**
 * 识别IP地理位置，支持缓存TTL机制和多API备用
 * @param {string} ip - IP地址
 * @param {number} apiTimeout - API查询超时时间
 * @param {number} ttlHours - 缓存有效期
 * @returns {Promise<string>} 地区代码
 */
async function getIpRegion(ip, apiTimeout = 5000, ttlHours = 168) {
  // 检查缓存是否有效
  if (regionCache[ip]) {
    const cachedData = regionCache[ip];
    if (typeof cachedData === 'object' && cachedData.timestamp) {
      if (isCacheValid(cachedData.timestamp, ttlHours)) {
        // 缓存命中，记录缓存来源（延迟输出）
        // 不立即输出，由调用方统一控制日志顺序
        return cachedData.region;
      }
    } else {
      // 兼容旧格式缓存
      return cachedData;
    }
  }

  // 创建axios实例
  const httpClient = axios.create({
    timeout: apiTimeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  });

  // 尝试主要API（免费版本）
  logger.infoWithEmoji(`🌐 IP ${ip} 开始API查询（主要API: ipinfo.io lite）...`);
  try {
    const response = await httpClient.get(`https://api.ipinfo.io/lite/${ip}?token=2cb674df499388`);
    if (response.status === 200) {
      const data = response.data;
      const countryCode = data.country_code?.toUpperCase();
      if (countryCode) {
        regionCache[ip] = {
          region: countryCode,
          timestamp: new Date().toISOString()
        };
        logger.success(`IP ${ip} 主要API识别成功: ${countryCode}（来源：API查询）`);
        return countryCode;
      } else {
        logger.warning(`⚠️ IP ${ip} 主要API返回的数据不完整`);
      }
    } else {
      logger.warning(`⚠️ IP ${ip} 主要API返回状态码: ${response.status}`);
    }
  } catch (error) {
    logger.error(`❌ IP ${ip} 主要API识别失败: ${error.message}`);
  }

  // 尝试备用API
  logger.infoWithEmoji(`🌐 IP ${ip} 尝试备用API（ip-api.com）...`);
  try {
    const response = await httpClient.get(`http://ip-api.com/json/${ip}?fields=countryCode`);
    if (response.data && response.data.status === 'success') {
      const countryCode = response.data.countryCode?.toUpperCase();
      if (countryCode) {
        regionCache[ip] = {
          region: countryCode,
          timestamp: new Date().toISOString()
        };
        logger.success(`IP ${ip} 备用API识别成功: ${countryCode}（来源：备用API查询）`);
        return countryCode;
      } else {
        logger.warning(`⚠️ IP ${ip} 备用API返回的数据不完整`);
      }
    } else {
      logger.warning(`⚠️ IP ${ip} 备用API返回状态: ${response.data?.status || 'unknown'}`);
    }
  } catch (error) {
    logger.error(`❌ IP ${ip} 备用API识别失败: ${error.message}`);
  }

  // 失败返回Unknown
  logger.warning(`❌ IP ${ip} 所有API识别失败，标记为Unknown`);
  regionCache[ip] = {
    region: 'Unknown',
    timestamp: new Date().toISOString()
  };
  return 'Unknown';
}

/**
 * 根据ISO国家代码获取中文名称
 * @param {string} code - 国家代码
 * @returns {string} 中文名称
 */
function getCountryName(code) {
  return countryMapping[code] || code;
}

/**
 * 并发识别IP地理位置，保持日志输出顺序
 * @param {Array<{ip: string, minDelay: number, avgDelay: number}>} ipData - IP数据列表
 * @param {number} maxWorkers - 最大并发数
 * @param {number} queryInterval - 查询间隔
 * @returns {Promise<Array<{ip: string, regionCode: string, minDelay: number, avgDelay: number}>>}
 */
async function getRegionsConcurrently(ipData, maxWorkers = 15, queryInterval = 200) {
  logger.infoWithEmoji(`🌍 开始并发地区识别 ${ipData.length} 个IP，使用 ${maxWorkers} 个线程`);

  const results = [];
  const startTime = Date.now();

  // 先收集所有结果，不输出日志
  for (let i = 0; i < ipData.length; i++) {
    const { ip, minDelay, avgDelay } = ipData[i];

    try {
      const regionCode = await getIpRegion(ip, 5000, 168);
      results.push({ ip, regionCode, minDelay, avgDelay });

      // 只在API查询时等待，缓存查询不需要等待
      if ((i + 1) % 10 === 0) { // 每10个IP等待一次，减少等待频率
        await new Promise(resolve => setTimeout(resolve, queryInterval));
      }
    } catch (error) {
      logger.warning(`地区识别失败 ${ip}: ${error.message}`);
      results.push({ ip, regionCode: 'Unknown', minDelay, avgDelay });
    }
  }

  // 所有结果收集完成后，先输出缓存获取日志，再输出地区识别结果
  for (let i = 0; i < results.length; i++) {
    const { ip, regionCode } = results[i];

    // 检查是否从缓存获取
    if (regionCache[ip]) {
      const cachedData = regionCache[ip];
      if (typeof cachedData === 'object' && cachedData.timestamp) {
        if (isCacheValid(cachedData.timestamp, 168)) {
          logger.infoWithEmoji(`📦 IP ${ip} 地区信息从缓存获取: ${cachedData.region}`);
        }
      }
    }

    logger.infoWithEmoji(`📦 [${i + 1}/${ipData.length}] ${ip} -> ${regionCode}`);
  }

  const totalTime = (Date.now() - startTime) / 1000;
  logger.infoWithEmoji(`🌍 地区识别完成，处理了 ${results.length} 个IP，总耗时: ${totalTime.toFixed(1)}秒`);

  return results;
}

/**
 * 获取缓存统计信息
 * @returns {number} 缓存条目数量
 */
function getCacheSize() {
  return Object.keys(regionCache).length;
}

module.exports = {
  loadRegionCache,
  saveRegionCache,
  isCacheValid,
  cleanExpiredCache,
  getIpRegion,
  getCountryName,
  getRegionsConcurrently,
  getRegionCache: getCacheSize
};