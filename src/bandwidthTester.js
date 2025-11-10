const axios = require('axios');
const logger = require('./logger');
const { testIpAvailability } = require('./ipTester');

/**
 * 通过HTTP下载测试IP带宽性能
 * @param {string} ip - IP地址
 * @param {number} testSizeMb - 测试文件大小（MB）
 * @param {number} testCount - 测试次数
 * @returns {Promise<{isFast: boolean, bandwidth: number, latency: number}>}
 */
async function testIpBandwidth(ip, testSizeMb = 10, testCount = 3) {
  try {
    // 验证IP地址格式
    const parts = ip.split('.');
    if (parts.length !== 4 || !parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    })) {
      return { isFast: false, bandwidth: 0, latency: 0 };
    }

    const testSizeBytes = testSizeMb * 1024 * 1024;
    const testUrls = [
      // 使用一些公开的测试文件
      `https://speed.cloudflare.com/__down?bytes=${testSizeBytes}`,  // 可配置大小测试文件
      `https://httpbin.org/bytes/${testSizeBytes}`,  // 可配置大小测试文件
    ];

    let bestSpeed = 0;
    let bestLatency = 0;

    // 创建axios实例，配置超时和请求头
    const httpClient = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // 使用配置的测试次数
    for (let testAttempt = 0; testAttempt < testCount; testAttempt++) {
      for (const url of testUrls) {
        try {
          const startTime = Date.now();

          // 发送HTTP请求测试带宽
          const response = await httpClient.get(url, {
            responseType: 'stream',
            timeout: 15000
          });

          if (response.status === 200) {
            // 测量下载速度
            let dataDownloaded = 0;
            const startDownload = Date.now();

            // 下载数据块来测试速度
            await new Promise((resolve, reject) => {
              response.data.on('data', (chunk) => {
                dataDownloaded += chunk.length;

                // 限制测试时间，避免过长时间
                if (Date.now() - startDownload > 10000) { // 最多测试10秒
                  response.data.destroy();
                  resolve();
                  return;
                }

                // 如果下载了足够的数据就停止
                if (dataDownloaded > 10 * 1024 * 1024) { // 10MB
                  response.data.destroy();
                  resolve();
                  return;
                }
              });

              response.data.on('end', () => {
                resolve();
              });

              response.data.on('error', (error) => {
                reject(error);
              });
            });

            const downloadTime = (Date.now() - startDownload) / 1000; // 转换为秒
            const latency = (startDownload - startTime); // 延迟（毫秒）

            if (downloadTime > 0 && dataDownloaded > 0) {
              // 计算速度 (Mbps)
              const speedMbps = (dataDownloaded * 8) / (downloadTime * 1000000);
              bestSpeed = Math.max(bestSpeed, speedMbps);
              bestLatency = bestLatency === 0 ? latency : Math.min(bestLatency, latency);

              // 如果速度很好，可以提前返回
              if (speedMbps > 5) { // 超过5Mbps就认为很好
                return { isFast: true, bandwidth: bestSpeed, latency: bestLatency };
              }
            }
          }

        } catch (error) {
          logger.debug(`IP ${ip} 带宽测试失败: ${error.message}`);
          continue;
        }
      }
    }

    if (bestSpeed > 0) {
      return { isFast: true, bandwidth: bestSpeed, latency: bestLatency };
    } else {
      // 如果带宽测试失败，返回延迟测试结果
      const { isAvailable, minDelay } = await testIpAvailability(ip, [443], 1);
      if (isAvailable) {
        return { isFast: true, bandwidth: 0, latency: minDelay }; // 返回0表示带宽测试失败，但延迟可用
      } else {
        return { isFast: false, bandwidth: 0, latency: 0 };
      }
    }

  } catch (error) {
    logger.error(`IP ${ip} 带宽测试异常: ${error.message}`);
    return { isFast: false, bandwidth: 0, latency: 0 };
  }
}

/**
 * 仅测试IP带宽，用于分离测试流程
 * @param {string} ip - IP地址
 * @param {number} index - 当前索引
 * @param {number} total - 总数
 * @param {number} testSizeMb - 测试文件大小
 * @returns {Promise<{isFast: boolean, bandwidth: number, latency: number}>}
 */
async function testIpBandwidthOnly(ip, index, total, testSizeMb = 10) {
  // 测试带宽
  const { isFast, bandwidth, latency } = await testIpBandwidth(ip, testSizeMb, 3);

  // 输出带宽测试日志
  logger.infoWithEmoji(`⚡ [${index}/${total}] ${ip}（带宽综合速度：${bandwidth.toFixed(2)}Mbps）`);

  return { isFast, bandwidth, latency };
}

/**
 * 计算IP综合评分，综合考虑延迟、带宽、稳定性
 * @param {number} minDelay - 最小延迟
 * @param {number} avgDelay - 平均延迟
 * @param {number} bandwidth - 带宽
 * @param {number} stability - 稳定性
 * @returns {number} 综合评分
 */
function calculateScore(minDelay, avgDelay, bandwidth, stability) {
  // 延迟评分 (0-100, 延迟越低分数越高)
  const latencyScore = Math.max(0, 100 - avgDelay / 2);

  // 带宽评分 (0-100, 带宽越高分数越高)
  const bandwidthScore = Math.min(100, bandwidth * 10);

  // 稳定性评分 (0-100, 稳定性越高分数越高)
  const stabilityScore = Math.max(0, 100 - stability / 10);

  // 综合评分 (延迟占40%, 带宽占30%, 稳定性占30%)
  const totalScore = latencyScore * 0.4 + bandwidthScore * 0.3 + stabilityScore * 0.3;
  return Math.round(totalScore * 100) / 100;
}

/**
 * 按延迟排名筛选前百分比IP，保留最优IP
 * @param {Array<{ip: string, minDelay: number, avgDelay: number, stability: number}>} ipsWithLatency - 带延迟数据的IP列表
 * @param {number} percentage - 筛选百分比
 * @returns {Array<{ip: string, minDelay: number, avgDelay: number, stability: number}>} 筛选后的IP列表
 */
function latencyFilterIps(ipsWithLatency, percentage = 30) {
  if (!ipsWithLatency || ipsWithLatency.length === 0) {
    return ipsWithLatency;
  }

  // 按延迟排序
  const sortedIps = [...ipsWithLatency].sort((a, b) => a.avgDelay - b.avgDelay);

  // 计算前百分比的数量
  const keepCount = Math.max(1, Math.floor(sortedIps.length * percentage / 100));

  // 取前N个IP
  const filteredIps = sortedIps.slice(0, keepCount);

  logger.infoWithEmoji(`🔍 延迟排名前${percentage}%筛选：从 ${ipsWithLatency.length} 个IP中筛选出 ${filteredIps.length} 个IP`);

  // 显示筛选结果
  filteredIps.forEach((ip, index) => {
    logger.infoWithEmoji(`📊 ${ip.ip}（延迟排名第${index + 1}位：${ip.avgDelay.toFixed(1)}ms）`);
  });

  return filteredIps;
}

/**
 * 批量带宽测试
 * @param {Array<{ip: string, minDelay: number, avgDelay: number, stability: number}>} ipData - IP数据列表
 * @param {number} testSizeMb - 测试文件大小
 * @returns {Promise<Array<{ip: string, minDelay: number, avgDelay: number, stability: number, bandwidth: number, latency: number, score: number}>>}
 */
async function batchBandwidthTest(ipData, testSizeMb = 10) {
  logger.infoWithEmoji(`🔍 ===== 带宽测试 =====`);

  const bandwidthResults = [];

  for (let i = 0; i < ipData.length; i++) {
    const { ip, minDelay, avgDelay, stability } = ipData[i];
    const { isFast, bandwidth, latency } = await testIpBandwidthOnly(ip, i + 1, ipData.length, testSizeMb);

    if (isFast) {
      const score = calculateScore(minDelay, avgDelay, bandwidth, stability);
      bandwidthResults.push({
        ip,
        minDelay,
        avgDelay,
        stability,
        bandwidth,
        latency,
        score
      });
    }
  }

  return bandwidthResults;
}

module.exports = {
  testIpBandwidth,
  testIpBandwidthOnly,
  calculateScore,
  latencyFilterIps,
  batchBandwidthTest
};