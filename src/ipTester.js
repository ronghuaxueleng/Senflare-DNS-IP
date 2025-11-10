const net = require('net');
const logger = require('./logger');

/**
 * 验证IP地址格式
 * @param {string} ip - IP地址
 * @returns {boolean} 是否有效
 */
function isValidIp(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

/**
 * 快速筛选IP，单次TCP连接测试，剔除明显不可用的IP
 * @param {string} ip - IP地址
 * @param {number[]} testPorts - 测试端口列表
 * @returns {Promise<{isGood: boolean, delay: number}>}
 */
async function quickFilterIp(ip, testPorts) {
  if (!isValidIp(ip)) {
    return { isGood: false, delay: 0 };
  }

  if (!testPorts || !Array.isArray(testPorts)) {
    return { isGood: false, delay: 0 };
  }

  let minDelay = Infinity;

  // 遍历配置的测试端口，只测试一次
  for (const port of testPorts) {
    if (typeof port !== 'number' || port < 1 || port > 65535) {
      continue;
    }

    try {
      const delay = await testTcpConnection(ip, port, 3000);
      minDelay = Math.min(minDelay, delay);

      // 如果延迟很好，立即返回
      if (delay < 200) {
        return { isGood: true, delay };
      }
    } catch (error) {
      continue; // 继续测试下一个端口
    }
  }

  // 如果延迟超过500ms，直接剔除
  if (minDelay > 500) {
    return { isGood: false, delay: 0 };
  }

  // 如果无法连接，直接剔除
  if (minDelay === Infinity) {
    return { isGood: false, delay: 0 };
  }

  return { isGood: true, delay: minDelay };
}

/**
 * 测试TCP连接延迟
 * @param {string} ip - IP地址
 * @param {number} port - 端口号
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<number>} 延迟（毫秒）
 */
function testTcpConnection(ip, port, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const delay = Date.now() - startTime;
      socket.destroy();
      resolve(delay);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('连接超时'));
    });

    socket.on('error', () => {
      socket.destroy();
      reject(new Error('连接失败'));
    });

    socket.connect(port, ip);
  });
}

/**
 * TCP Socket检测IP可用性，多次ping测试获取准确延迟数据
 * @param {string} ip - IP地址
 * @param {number[]} testPorts - 测试端口列表
 * @param {number} pingCount - ping测试次数
 * @returns {Promise<{isAvailable: boolean, minDelay: number, avgDelay: number, stability: number}>}
 */
async function testIpAvailability(ip, testPorts, pingCount = 5) {
  if (!isValidIp(ip)) {
    return { isAvailable: false, minDelay: 0, avgDelay: 0, stability: 0 };
  }

  if (!testPorts || !Array.isArray(testPorts)) {
    logger.warning(`⚠️ 测试端口配置无效，跳过IP ${ip}`);
    return { isAvailable: false, minDelay: 0, avgDelay: 0, stability: 0 };
  }

  const allDelays = [];
  let successCount = 0;

  // 多次ping测试
  for (let pingAttempt = 0; pingAttempt < pingCount; pingAttempt++) {
    let minDelay = Infinity;

    // 遍历配置的测试端口
    for (const port of testPorts) {
      if (typeof port !== 'number' || port < 1 || port > 65535) {
        continue;
      }

      try {
        const delay = await testTcpConnection(ip, port, 3000);
        minDelay = Math.min(minDelay, delay);

        // 如果延迟很好，记录并继续
        if (delay < 200) {
          allDelays.push(delay);
          successCount++;
          break; // 找到好的延迟就跳出端口循环
        }
      } catch (error) {
        continue; // 继续测试下一个端口
      }
    }

    // 如果这次ping没有成功，记录一个高延迟值
    if (minDelay === Infinity) {
      allDelays.push(999); // 标记为失败
    } else {
      allDelays.push(minDelay);
    }
  }

  // 计算统计结果
  if (successCount > 0) {
    // 过滤掉失败的值（999）
    const validDelays = allDelays.filter(d => d < 999);
    if (validDelays.length > 0) {
      const minDelay = Math.min(...validDelays);
      const avgDelay = validDelays.reduce((sum, d) => sum + d, 0) / validDelays.length;

      // 计算稳定性（方差）
      const variance = validDelays.reduce((sum, d) => sum + Math.pow(d - avgDelay, 2), 0) / validDelays.length;
      const stability = Math.round(variance * 100) / 100;

      return {
        isAvailable: true,
        minDelay,
        avgDelay: Math.round(avgDelay * 100) / 100,
        stability
      };
    }
  }

  return { isAvailable: false, minDelay: 0, avgDelay: 0, stability: 0 };
}

/**
 * 批量快速筛选IP
 * @param {string[]} ips - IP地址列表
 * @param {number[]} testPorts - 测试端口列表
 * @param {number} maxWorkers - 最大并发数
 * @returns {Promise<string[]>} 筛选后的IP列表
 */
async function quickFilterIps(ips, testPorts, maxWorkers = 15) {
  logger.infoWithEmoji(`🔍 开始快速筛选 ${ips.length} 个IP，剔除明显不好的IP...`);

  const filteredIps = [];
  const startTime = Date.now();

  // 使用Promise.all进行并发处理，但限制并发数
  const results = await Promise.allSettled(
    ips.map(ip => quickFilterIp(ip, testPorts))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const ip = ips[i];

    if (result.status === 'fulfilled') {
      const { isGood, delay } = result.value;
      if (isGood) {
        filteredIps.push(ip);
        logger.success(`可用 ${ip}（延迟 ${delay}ms）`);
      } else {
        logger.infoWithEmoji(`❌ ${ip} 被快速筛选剔除`);
      }
    } else {
      logger.error(`${ip} 快速筛选出错: ${result.reason?.message || result.reason}`);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logger.infoWithEmoji(`🔍 快速筛选完成，从 ${ips.length} 个IP中筛选出 ${filteredIps.length} 个IP，耗时: ${elapsed.toFixed(1)}秒`);

  return filteredIps;
}

/**
 * 并发检测IP可用性
 * @param {string[]} ips - IP地址列表
 * @param {number[]} testPorts - 测试端口列表
 * @param {number} maxWorkers - 最大并发数
 * @param {number} batchSize - 批次大小
 * @returns {Promise<Array<{ip: string, minDelay: number, avgDelay: number, stability: number}>>}
 */
async function testIpsConcurrently(ips, testPorts, maxWorkers = 15, batchSize = 10) {
  logger.infoWithEmoji(`📡 开始并发检测 ${ips.length} 个IP，使用 ${maxWorkers} 个线程，测试类型: 延迟`);

  const availableIps = [];
  const startTime = Date.now();

  // 使用更小的批次，避免卡住
  for (let i = 0; i < ips.length; i += batchSize) {
    const batchIps = ips.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(ips.length / batchSize);

    logger.infoWithEmoji(`📡 处理批次 ${batchNum}/${totalBatches}，包含 ${batchIps.length} 个IP`);

    // 并发处理当前批次
    const batchResults = await Promise.allSettled(
      batchIps.map(ip => testIpAvailability(ip, testPorts, 5))
    );

    // 处理批次结果
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const ip = batchIps[j];
      const completed = i + j + 1;
      const elapsed = (Date.now() - startTime) / 1000;

      if (result.status === 'fulfilled') {
        const { isAvailable, minDelay, avgDelay, stability } = result.value;
        if (isAvailable) {
          availableIps.push({ ip, minDelay, avgDelay, stability });
          logger.infoWithEmoji(`🎯 [${completed}/${ips.length}] ${ip}（TCP Ping 综合延迟：${avgDelay.toFixed(1)}ms）`);
        } else {
          logger.infoWithEmoji(`[${completed}/${ips.length}] ${ip} ❌ 不可用`);
        }
      } else {
        logger.error(`[${completed}/${ips.length}] ${ip} ❌ 检测出错: ${result.reason?.message || result.reason} - 耗时: ${elapsed.toFixed(1)}s`);
      }
    }

    // 批次间短暂休息，避免过度占用资源
    if (i + batchSize < ips.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  logger.infoWithEmoji(`📡 并发检测完成，发现 ${availableIps.length} 个可用IP，总耗时: ${totalTime.toFixed(1)}秒`);

  return availableIps;
}

module.exports = {
  isValidIp,
  quickFilterIp,
  testTcpConnection,
  testIpAvailability,
  quickFilterIps,
  testIpsConcurrently
};