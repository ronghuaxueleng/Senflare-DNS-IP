/**
 * DNS IP Test - Cloudflare优选域名解析器 v1.0.0 (Node.js版本)
 * 高效解析、检测和识别Cloudflare优选域名的IP状态和详情信息

主要功能:
- DNS解析：多DNS服务器并发解析域名获取IP地址
- 快速筛选：TCP连接测试剔除明显不可用的IP
- 延迟测试：TCP Ping测试获取准确延迟数据
- 带宽测试：HTTP下载测试测量IP带宽性能
- 地区识别：API查询IP地理位置信息并缓存
- 智能排序：综合延迟、带宽、稳定性进行评分排序
- 文件输出：生成基础版和高级版IP列表文件

技术特性:
- 智能缓存系统：支持TTL机制，减少重复API调用
- 并发处理：多线程并发大幅提升检测速度
- 错误处理：完善的异常处理和重试机制
- 日志系统：详细的操作日志记录，支持文件输出
- 资源管理：自动限制缓存大小，防止内存溢出
*/

const { dnsServers, testPorts, timeout, queryInterval, maxWorkers, batchSize, cacheTtlHours, advancedMode, tcpPingCount, bandwidthTestCount, bandwidthTestSizeMb, latencyFilterPercentage } = require('../config/config');
const logger = require('./logger');
const { resolveDomain } = require('./dnsResolver');
const { quickFilterIps, testIpsConcurrently, quickFilterIp } = require('./ipTester');
const { batchBandwidthTest, latencyFilterIps } = require('./bandwidthTester');
const { loadRegionCache, saveRegionCache, cleanExpiredCache, getCountryName, getRegionsConcurrently, getRegionCache } = require('./geoResolver');
const { cleanOutputFiles, loadDomainList, saveIpList, saveFormattedRecords, saveRankingDetails } = require('./fileUtils');

/**
 * 主程序流程控制
 */
async function main() {
  const startTime = Date.now();

  try {
    // 1. 预处理：删除旧文件
    await cleanOutputFiles();

    // 2. 加载域名列表
    logger.infoWithEmoji("📥 ===== 加载域名列表 =====");
    const domains = await loadDomainList();

    if (domains.length === 0) {
      logger.warning("⚠️ 没有找到任何域名，程序结束");
      return;
    }

    // 3. 多方法解析获取IP地址
    logger.infoWithEmoji("🔍 ===== 多方法解析域名 =====");
    const allIps = [];
    let successfulDomains = 0;
    let failedDomains = 0;

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      try {
        logger.infoWithEmoji(`🔍 解析域名 ${domain}...`);

        // 添加请求间隔，避免频率限制
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, queryInterval));
        }

        // 使用DNS解析
        const ips = await resolveDomain(domain, dnsServers);
        if (ips.length > 0) {
          allIps.push(...ips);
          successfulDomains++;
          logger.success(`成功解析 ${domain}，获得 ${ips.length} 个IP地址`);
        } else {
          failedDomains++;
          logger.warning(`❌ 解析 ${domain} 失败，未获得IP地址`);
        }
      } catch (error) {
        failedDomains++;
        const errorMsg = error.message;
        logger.error(`❌ 解析 ${domain} 出错: ${errorMsg}`);
      }
    }

    logger.infoWithEmoji(`📊 解析统计: 成功 ${successfulDomains} 个域名，失败 ${failedDomains} 个域名`);

    // 4. IP去重与排序
    logger.infoWithEmoji(`🔢 去重前共 ${allIps.length} 个IP地址`);
    const uniqueIps = [...new Set(allIps)].sort((a, b) => {
      // 按IP地址数值排序
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < 4; i++) {
        if (aParts[i] !== bParts[i]) {
          return aParts[i] - bParts[i];
        }
      }
      return 0;
    });
    logger.infoWithEmoji(`🔢 去重后共 ${uniqueIps.length} 个唯一IP地址`);

    // 检查是否有重复IP
    if (allIps.length !== uniqueIps.length) {
      logger.infoWithEmoji(`🔍 发现重复IP，已去重 ${allIps.length - uniqueIps.length} 个重复项`);
    }

    // 检查是否有IP需要检测
    if (uniqueIps.length === 0) {
      logger.warning("⚠️ 没有解析到任何IP地址，程序结束");
      return;
    }

    // 5. 快速筛选IP（剔除明显不好的）
    logger.infoWithEmoji("🔍 ===== 快速筛选IP =====");
    const filteredIps = await quickFilterIps(uniqueIps, testPorts, maxWorkers);

    if (filteredIps.length === 0) {
      logger.warning("⚠️ 快速筛选后没有可用IP，程序结束");
      return;
    }

    // 6. 立即保存基础文件（快速筛选完成后）
    logger.infoWithEmoji("📄 ===== 保存基础文件 =====");
    await saveIpList(filteredIps, 'DNSIPlist.txt');

    // 7. 立即进行地区识别与结果格式化（提前保存SenflareDNS.txt）
    logger.infoWithEmoji("🌍 ===== 并发地区识别与结果格式化 =====");
    // 使用快速筛选的IP进行地区识别
    const ipDelayData = filteredIps.map(ip => ({ ip, minDelay: 0, avgDelay: 0 }));

    const regionResults = await getRegionsConcurrently(ipDelayData, maxWorkers, queryInterval);

    // 按地区分组
    const regionGroups = {};
    for (const { ip, regionCode, minDelay, avgDelay } of regionResults) {
      const countryName = getCountryName(regionCode);
      if (!regionGroups[countryName]) {
        regionGroups[countryName] = [];
      }
      regionGroups[countryName].push({ ip, regionCode, minDelay, avgDelay });
    }

    logger.infoWithEmoji(`🌍 地区分组完成，共 ${Object.keys(regionGroups).length} 个地区`);

    // 生成并保存最终结果
    const result = [];
    const sortedRegions = Object.keys(regionGroups).sort();

    for (const region of sortedRegions) {
      // 同一地区内按延迟排序（更快的在前）
      const sortedIps = regionGroups[region].sort((a, b) => a.minDelay - b.minDelay);
      for (let idx = 0; idx < sortedIps.length; idx++) {
        const { ip, code } = sortedIps[idx];
        result.push(`${ip}#${code} ${region}节点 | ${(idx + 1).toString().padStart(2, '0')}`);
      }
      logger.debug(`地区 ${region} 格式化完成，包含 ${sortedIps.length} 个IP`);
    }

    if (result.length > 0) {
      // 立即保存基础文件
      await saveFormattedRecords(result, 'SenflareDNS.txt');
    } else {
      logger.warning("⚠️ 无有效记录可保存");
    }

    // 高级功能处理（仅当开启高级模式时）
    if (advancedMode) {
      // 8. 延迟排名前30%筛选（基于快速筛选结果）
      logger.infoWithEmoji("🔍 ===== 延迟排名前30%筛选 =====");
      // 对快速筛选的IP进行延迟排名筛选，使用快速筛选的实际延迟数据
      const quickFilterResults = [];
      for (const ip of filteredIps) {
        const { isGood, delay } = await quickFilterIp(ip, testPorts);
        if (isGood) {
          quickFilterResults.push({ ip, minDelay: delay, avgDelay: delay, stability: 0 });
        }
      }

      const latencyFilteredIps = latencyFilterIps(quickFilterResults, latencyFilterPercentage);

      // 9. TCP Ping测试（只测试延迟，不测试带宽）
      logger.infoWithEmoji("🔍 ===== TCP Ping测试 =====");
      const latencyTestIps = latencyFilteredIps.map(item => item.ip);
      const tcpPingResults = await testIpsConcurrently(latencyTestIps, testPorts, maxWorkers, batchSize);

      // 10. 带宽测试（只对筛选后的IP进行带宽测试）
      logger.infoWithEmoji("🔍 ===== 带宽测试 =====");
      const availableIps = await batchBandwidthTest(tcpPingResults, bandwidthTestSizeMb);

      // 11. 保存高级文件（按评分排序）
      if (availableIps.length > 0) {
        // 按评分排序
        availableIps.sort((a, b) => b.score - a.score);
        logger.infoWithEmoji(`📊 按综合评分排序完成`);

        // 保存高级文件（高级选项）
        // 保存优选IP
        const proIps = availableIps.map(item => item.ip);
        await saveIpList(proIps, 'DNSIPlist-Pro.txt');

        // 保存排名详情
        await saveRankingDetails(availableIps, 'Ranking.txt');

        // 保存高级格式化文件（使用优选IP重新生成）
        logger.infoWithEmoji("🌍 ===== 高级地区识别与结果格式化 =====");
        // 使用优选IP进行地区识别
        const proIpDelayData = availableIps.map(item => ({ ip: item.ip, minDelay: 0, avgDelay: 0 }));

        const proRegionResults = await getRegionsConcurrently(proIpDelayData, maxWorkers, queryInterval);

        // 按地区分组
        const proRegionGroups = {};
        for (const { ip, regionCode, minDelay, avgDelay } of proRegionResults) {
          const countryName = getCountryName(regionCode);
          if (!proRegionGroups[countryName]) {
            proRegionGroups[countryName] = [];
          }
          proRegionGroups[countryName].push({ ip, regionCode, minDelay, avgDelay });
        }

        logger.infoWithEmoji(`🌍 高级地区分组完成，共 ${Object.keys(proRegionGroups).length} 个地区`);

        // 生成高级格式化结果
        const proResult = [];
        const proSortedRegions = Object.keys(proRegionGroups).sort();

        for (const region of proSortedRegions) {
          // 同一地区内按延迟排序（更快的在前）
          const sortedIps = proRegionGroups[region].sort((a, b) => a.minDelay - b.minDelay);
          for (let idx = 0; idx < sortedIps.length; idx++) {
            const { ip, code } = sortedIps[idx];
            proResult.push(`${ip}#${code} ${region}节点 | ${(idx + 1).toString().padStart(2, '0')}`);
          }
          logger.debug(`高级地区 ${region} 格式化完成，包含 ${sortedIps.length} 个IP`);
        }

        if (proResult.length > 0) {
          await saveFormattedRecords(proResult, 'SenflareDNS-Pro.txt');
        } else {
          logger.warning("⚠️ 高级版无有效记录可保存");
        }
      }
    }

    // 12. 保存缓存并显示统计信息
    await saveRegionCache();

    // 显示总耗时
    const runTime = (Date.now() - startTime) / 1000;
    logger.infoWithEmoji(`⏱️ 总耗时: ${runTime.toFixed(2)}秒`);
    logger.infoWithEmoji(`📊 缓存统计: 总计 ${getRegionCache()} 个`);
    logger.infoWithEmoji("🏁 ===== 程序完成 =====");

  } catch (error) {
    logger.error(`❌ 程序运行出错: ${error.message}`);
    logger.error(`错误堆栈: ${error.stack}`);
  }
}

/**
 * 程序启动入口
 */
async function start() {
  // 程序启动日志
  logger.infoWithEmoji("🚀 ===== 开始DNS IP处理程序 (Node.js版本) =====");

  try {
    // 初始化缓存系统
    await loadRegionCache();
    // 清理过期缓存条目
    cleanExpiredCache(cacheTtlHours);
    // 执行主程序流程
    await main();
  } catch (error) {
    logger.error(`❌ 程序启动失败: ${error.message}`);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error(`❌ 未捕获的异常: ${error.message}`);
  logger.error(`错误堆栈: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`❌ 未处理的Promise拒绝: ${reason}`);
  process.exit(1);
});

// 处理中断信号
process.on('SIGINT', () => {
  logger.infoWithEmoji("⏹️ 程序被用户中断");
  process.exit(0);
});

// 启动程序
if (require.main === module) {
  start();
}

module.exports = {
  main,
  start
};