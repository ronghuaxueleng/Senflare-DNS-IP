const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

/**
 * 删除指定文件（如果存在），避免结果累积
 * @param {string} filePath - 文件路径
 */
async function deleteFileIfExists(filePath) {
  if (await fs.pathExists(filePath)) {
    try {
      await fs.remove(filePath);
      logger.infoWithEmoji(`🗑️ 已删除原有文件: ${filePath}`);
    } catch (error) {
      logger.warning(`⚠️ 删除文件失败: ${error.message}`);
    }
  }
}

/**
 * 从YXhost-lite.txt文件加载域名列表，支持注释行过滤
 * @returns {Promise<string[]>} 域名列表
 */
async function loadDomainList() {
  const domains = [];
  const domainFile = path.join(process.cwd(), 'config', 'YXhost-lite.txt');

  if (await fs.pathExists(domainFile)) {
    try {
      const data = await fs.readFile(domainFile, 'utf8');
      const lines = data.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          // 提取域名部分，忽略#后面的描述信息
          const domain = trimmedLine.split('#')[0].trim();
          if (domain) {
            domains.push(domain);
          }
        }
      }

      logger.infoWithEmoji(`📄 成功加载 ${domains.length} 个域名`);
    } catch (error) {
      logger.error(`❌ 加载域名文件失败: ${error.message}`);
    }
  } else {
    logger.warning("⚠️ YXhost-lite.txt 文件不存在");
  }

  return domains;
}

/**
 * 保存IP列表到文件
 * @param {string[]} ips - IP地址列表
 * @param {string} filename - 文件名
 */
async function saveIpList(ips, filename) {
  const filePath = path.join(process.cwd(), filename);

  try {
    const content = ips.join('\n') + (ips.length > 0 ? '\n' : '');
    await fs.writeFile(filePath, content, 'utf8');
    logger.infoWithEmoji(`📄 已保存 ${ips.length} 个可用IP到 ${filename}`);
  } catch (error) {
    logger.error(`❌ 保存IP列表失败: ${error.message}`);
  }
}

/**
 * 保存格式化的DNS记录到文件
 * @param {string[]} records - 格式化记录列表
 * @param {string} filename - 文件名
 */
async function saveFormattedRecords(records, filename) {
  const filePath = path.join(process.cwd(), filename);

  try {
    const content = records.join('\n') + (records.length > 0 ? '\n' : '');
    await fs.writeFile(filePath, content, 'utf8');
    logger.infoWithEmoji(`📄 已保存 ${records.length} 条格式化记录到 ${filename}`);
  } catch (error) {
    logger.error(`❌ 保存格式化记录失败: ${error.message}`);
  }
}

/**
 * 保存排名详情到文件
 * @param {Array<{ip: string, minDelay: number, avgDelay: number, bandwidth: number, score: number}>} rankingData - 排名数据
 * @param {string} filename - 文件名
 */
async function saveRankingDetails(rankingData, filename) {
  const filePath = path.join(process.cwd(), filename);

  try {
    const lines = rankingData.map((item, index) => {
      return `📊 [${index + 1}/${rankingData.length}] ${item.ip}（延迟 ${item.minDelay}ms，带宽 ${item.bandwidth.toFixed(2)}Mbps，评分 ${item.score.toFixed(1)}）`;
    });

    const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
    await fs.writeFile(filePath, content, 'utf8');
    logger.infoWithEmoji(`📄 已保存排名详情到 ${filename}`);
  } catch (error) {
    logger.error(`❌ 保存排名详情失败: ${error.message}`);
  }
}

/**
 * 批量删除输出文件
 */
async function cleanOutputFiles() {
  const filesToDelete = [
    'DNSIPlist.txt',
    'SenflareDNS.txt',
    'DNSIPlist-Pro.txt',
    'SenflareDNS-Pro.txt',
    'Ranking.txt'
  ];

  for (const filename of filesToDelete) {
    await deleteFileIfExists(filename);
  }

  logger.infoWithEmoji("🗑️ 预处理完成，旧文件已清理");
}

module.exports = {
  deleteFileIfExists,
  loadDomainList,
  saveIpList,
  saveFormattedRecords,
  saveRankingDetails,
  cleanOutputFiles
};