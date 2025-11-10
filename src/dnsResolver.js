const dns = require('dns').promises;
const net = require('net');
const logger = require('./logger');

/**
 * 使用多个DNS服务器解析域名获取IP地址
 * @param {string} domain - 要解析的域名
 * @param {Object} dnsServers - DNS服务器配置
 * @returns {Promise<string[]>} 解析到的IP地址列表
 */
async function resolveDomain(domain, dnsServers) {
  const allIps = new Set();
  const successfulServers = [];
  const failedServers = [];

  logger.infoWithEmoji(`🔍 开始解析域名 ${domain}，使用 ${Object.keys(dnsServers).length} 个DNS服务器...`);

  // 尝试多个DNS服务器
  const serverEntries = Object.entries(dnsServers);
  for (let i = 0; i < serverEntries.length; i++) {
    const [dnsServer, dnsProvider] = serverEntries[i];

    try {
      // 设置DNS服务器
      const resolver = new dns.Resolver();
      resolver.setServers([dnsServer]);

      // 解析域名
      const ips = await resolver.resolve4(domain);
      const validIps = ips.filter(ip => {
        // 验证IP地址格式
        const parts = ip.split('.');
        return parts.length === 4 && parts.every(part => {
          const num = parseInt(part, 10);
          return !isNaN(num) && num >= 0 && num <= 255;
        });
      });

      if (validIps.length > 0) {
        successfulServers.push([dnsServer, dnsProvider]);
        validIps.forEach(ip => allIps.add(ip));
        const uniqueCount = allIps.size;
        logger.infoWithEmoji(`🔍 [${String(i + 1).padStart(2)}/${serverEntries.length}] ${domain} -> ${validIps.length} 个IP (${dnsProvider}: ${dnsServer}) | 累计唯一IP: ${uniqueCount}`);
        logger.infoWithEmoji(`📋 ${dnsProvider}(${dnsServer}) 解析到的IP: ${validIps.join(', ')}`);
      } else {
        failedServers.push([dnsServer, dnsProvider]);
        logger.debug(`❌ [${String(i + 1).padStart(2)}/${serverEntries.length}] DNS服务器 ${dnsServer} 未返回有效IP`);
      }

    } catch (error) {
      failedServers.push([dnsServer, dnsProvider]);
      logger.debug(`❌ [${String(i + 1).padStart(2)}/${serverEntries.length}] DNS服务器 ${dnsServer} 解析 ${domain} 失败: ${error.message}`);

      // 失败重试一次（仅对关键DNS服务器）
      if (['223.5.5.5', '223.6.6.6', '119.29.29.29'].includes(dnsServer)) {
        try {
          logger.infoWithEmoji(`🔄 重试DNS服务器 ${dnsServer}...`);

          const retryResolver = new dns.Resolver();
          retryResolver.setServers([dnsServer]);
          const ips = await retryResolver.resolve4(domain);
          const validIps = ips.filter(ip => {
            const parts = ip.split('.');
            return parts.length === 4 && parts.every(part => {
              const num = parseInt(part, 10);
              return !isNaN(num) && num >= 0 && num <= 255;
            });
          });

          if (validIps.length > 0) {
            successfulServers.push([dnsServer, dnsProvider]);
            validIps.forEach(ip => allIps.add(ip));
            const uniqueCount = allIps.size;
            logger.success(`重试成功 [${String(i + 1).padStart(2)}/${serverEntries.length}] ${domain} -> ${validIps.length} 个IP (${dnsProvider}: ${dnsServer}) | 累计唯一IP: ${uniqueCount}`);
            logger.infoWithEmoji(`📋 ${dnsProvider}(${dnsServer}) 重试解析到的IP: ${validIps.join(', ')}`);
          } else {
            logger.debug(`❌ 重试失败 [${String(i + 1).padStart(2)}/${serverEntries.length}] DNS服务器 ${dnsServer} 重试后仍无有效IP`);
          }

        } catch (retryError) {
          logger.debug(`❌ 重试失败 [${String(i + 1).padStart(2)}/${serverEntries.length}] DNS服务器 ${dnsServer} 重试失败: ${retryError.message}`);
        }
      }
    }

    // 添加间隔避免频率限制
    if (i < serverEntries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const uniqueIps = Array.from(allIps);
  logger.infoWithEmoji(`📊 ${domain} 解析完成: 成功 ${successfulServers.length} 个DNS服务器，失败 ${failedServers.length} 个，获得 ${uniqueIps.length} 个唯一IP`);

  // 显示成功的DNS服务器
  if (successfulServers.length > 0) {
    const successList = successfulServers.map(([server, provider]) => `${provider}(${server})`).join(', ');
    logger.success(`成功的DNS服务器: ${successList}`);
  }

  // 显示失败的DNS服务器
  if (failedServers.length > 0) {
    const failList = failedServers.map(([server, provider]) => `${provider}(${server})`).join(', ');
    logger.warning(`失败的DNS服务器: ${failList}`);
  }

  // 显示所有解析到的IP
  if (uniqueIps.length > 0) {
    logger.infoWithEmoji(`📋 解析到的IP列表: ${uniqueIps.join(', ')}`);
  }

  return uniqueIps;
}

module.exports = {
  resolveDomain
};