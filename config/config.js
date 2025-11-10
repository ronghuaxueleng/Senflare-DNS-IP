// 核心配置文件
module.exports = {
  // DNS服务器配置 - 中国大陆DNS服务器（获取大陆延迟最低的IP）
  dnsServers: {
    // 公共DNS服务器（返回国内优化IP，延迟较低）
    '223.5.5.5': '阿里云-DNS',      // 阿里云DNS
    '223.6.6.6': '阿里云-DNS',      // 阿里云DNS
    '180.76.76.76': '百度-DNS',     // 百度DNS
    '119.29.29.29': '腾讯-DNS',     // 腾讯云DNS
    '182.254.116.116': '腾讯-DNS',  // 腾讯云DNS
    '114.114.114.114': '114-DNS',   // 114DNS
    '114.114.115.115': '114-DNS',   // 114DNS

    // 中国联通DNS
    '123.123.123.123': '中国联通-DNS',  // 联通DNS
    '123.123.123.124': '中国联通-DNS',  // 联通DNS
  },

  // 网络测试配置
  testPorts: [443],             // TCP连接测试端口（HTTPS端口）
  timeout: 15,                  // DNS解析超时时间（秒）
  apiTimeout: 5,                // API查询超时时间（秒）
  queryInterval: 200,           // API查询间隔时间（毫秒）

  // 并发处理配置
  maxWorkers: 15,               // 最大并发线程数
  batchSize: 10,                // 批量处理IP数量
  cacheTtlHours: 168,           // 缓存有效期（7天）

  // 高级功能配置
  advancedMode: true,           // 高级模式开关
  tcpPingCount: 5,              // TCP Ping测试次数
  bandwidthTestCount: 3,        // 带宽测试次数
  bandwidthTestSizeMb: 10,      // 带宽测试文件大小（MB）
  latencyFilterPercentage: 30,  // 延迟排名前百分比（取前30%的IP）
};

// 国家/地区映射表
module.exports.countryMapping = {
  // 北美
  'US': '美国', 'CA': '加拿大', 'MX': '墨西哥',
  // 南美
  'BR': '巴西', 'AR': '阿根廷', 'CL': '智利', 'CO': '哥伦比亚',
  // 欧洲
  'UK': '英国', 'GB': '英国', 'FR': '法国', 'DE': '德国', 'IT': '意大利',
  'ES': '西班牙', 'NL': '荷兰', 'RU': '俄罗斯', 'SE': '瑞典', 'CH': '瑞士',
  // 亚洲
  'CN': '中国', 'HK': '中国香港', 'TW': '中国台湾', 'MO': '中国澳门',
  'JP': '日本', 'KR': '韩国', 'SG': '新加坡', 'IN': '印度', 'ID': '印度尼西亚',
  'MY': '马来西亚', 'TH': '泰国', 'PH': '菲律宾', 'VN': '越南',
  // 大洋洲
  'AU': '澳大利亚', 'NZ': '新西兰',
  // 非洲
  'ZA': '南非', 'EG': '埃及', 'NG': '尼日利亚',
  // 其他
  'Unknown': '未知'
};