# Senflare-DNS-IP (Node.js版本)

🚀 **智能DNS解析器** - 基于Node.js构建的Cloudflare优选域名DNS解析器，支持多DNS服务器并发解析、智能IP筛选、性能测试和地理位置识别。

## ✨ 核心特性

### 🔍 DNS解析能力
- **多DNS服务器**: 支持9个国内主流DNS服务器并发解析
- **运营商分流**: 电信、联通、移动等运营商DNS全覆盖
- **智能去重**: 自动合并重复IP，最大化IP利用率
- **错误容错**: 部分DNS服务器失败不影响整体解析

### 📡 性能测试
- **并发检测**: 多线程并发IP可用性检测
- **延迟测试**: 精确的TCP Ping延迟测量
- **带宽测试**: HTTP下载速度测试
- **综合评分**: 延迟(40%) + 带宽(30%) + 稳定性(30%)

### 🌍 智能识别
- **地理位置**: 自动识别IP所属国家/地区
- **多API支持**: ipinfo.io + ip-api.com 双重保障
- **智能缓存**: 7天TTL缓存，避免重复查询
- **批量处理**: 支持多域名批量解析

### 📊 输出优化
- **分级输出**: 基础版 + 优选版双套结果
- **格式化输出**: 多种输出格式满足不同需求
- **详细排名**: 完整的性能评分排名
- **日志记录**: 完整的运行日志便于调试

## 🚀 快速开始

### 前置要求
- **Node.js**: >= 16.0.0
- **内存**: 建议 >= 256MB
- **网络**: 稳定的互联网连接

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/Senflare-DNS-IP.git
cd Senflare-DNS-IP

# 2. 安装依赖
npm install

# 3. 配置域名（可选）
# 编辑 config/YXhost-lite.txt 添加你的域名

# 4. 运行程序
npm start
```

### 运行命令

```bash
# 启动主程序
npm start

# 开发模式（带调试）
npm run dev

# 直接运行
node src/index.js
```

## 📁 项目结构

```
Senflare-DNS-IP/
├── 📂 src/                    # 源代码目录
│   ├── 🚀 index.js           # 主程序入口
│   ├── 🌐 dnsResolver.js     # DNS解析模块
│   ├── 📡 ipTester.js        # IP可用性测试模块
│   ├── ⚡ bandwidthTester.js # 带宽测试模块
│   ├── 🌍 geoResolver.js     # 地理位置识别模块
│   ├── 📝 logger.js          # 日志系统模块
│   └── 📄 fileUtils.js       # 文件操作工具模块
├── 📂 config/                 # 配置文件目录
│   ├── ⚙️ config.js          # 主配置文件
│   └── 📋 YXhost-lite.txt    # 域名列表配置
├── 📂 data/                   # 运行时数据目录
│   └── 💾 Cache-nodejs.json  # IP地区信息缓存
├── 📂 logs/                   # 日志输出目录
│   └── 📜 DNSIPtest-nodejs.log
├── 📄 package.json            # Node.js项目配置
├── 📄 README.md              # 项目说明文档
└── 📄 .gitignore             # Git忽略配置
```

## 📋 输出文件说明

程序运行后会在项目根目录生成以下文件：

### 基础版输出
- **📄 DNSIPlist.txt** - 所有可用IP列表（一行一个IP）
- **📄 SenflareDNS.txt** - 格式化基础结果（IP+地区+基础信息）

### 优选版输出
- **📄 DNSIPlist-Pro.txt** - 精选优质IP列表（按性能排序）
- **📄 SenflareDNS-Pro.txt** - 格式化优选结果（完整性能信息）
- **📄 Ranking.txt** - 详细的性能评分排名报告

### 系统文件
- **💾 data/Cache-nodejs.json** - IP地区信息缓存（7天有效期）
- **📜 logs/DNSIPtest-nodejs.log** - 详细的运行日志

## ⚙️ 配置说明

### 域名配置
编辑 `config/YXhost-lite.txt` 文件，每行一个域名：

```text
# Cloudflare优选域名列表
# 格式：域名#描述信息（可选）

q.quuvv.cn#用户添加域名
orange.seeck.cn#简睿域名
nrtcfdns.zone.id#简睿备用域名
```

### 系统配置
主配置文件位于 `config/config.js`，包含以下配置：

#### DNS服务器配置
- **9个国内主流DNS服务器**：阿里云、腾讯云、百度、114DNS、联通DNS等
- **DNS解析超时**：默认5秒
- **并发解析数**：9个DNS服务器同时解析

#### 性能测试配置
- **测试端口**：默认443（HTTPS）
- **并发线程数**：最大15个
- **连接超时**：3秒
- **测试次数**：默认3次取平均值

#### 缓存系统配置
- **缓存有效期**：7天（168小时）
- **缓存文件**：`data/Cache-nodejs.json`
- **最大缓存条目**：1000个（自动清理过期条目）

#### 筛选算法配置
- **延迟筛选**：前30%最优IP
- **综合评分**：延迟(40%) + 带宽(30%) + 稳定性(30%)
- **地区识别**：支持双重API备用机制

## 🏗️ 技术架构

### 核心模块设计

| 模块 | 功能描述 | 主要特性 |
|------|----------|----------|
| **index.js** | 主程序入口 | 流程控制、模块协调 |
| **dnsResolver.js** | DNS解析引擎 | 多DNS并发、智能去重 |
| **ipTester.js** | IP可用性检测 | TCP连接测试、延迟测量 |
| **bandwidthTester.js** | 带宽性能测试 | HTTP下载测试、速度评估 |
| **geoResolver.js** | 地理位置识别 | API调用、缓存管理 |
| **logger.js** | 日志系统 | Winston引擎、多级输出 |
| **fileUtils.js** | 文件操作工具 | 格式化输出、结果保存 |

### 技术栈

- **运行环境**: Node.js 16+
- **核心依赖**:
  - `axios` - HTTP请求库
  - `winston` - 日志系统
  - `fs-extra` - 增强文件操作
  - `p-limit` - 并发控制
  - `dns2` - DNS解析（备用）

### 架构特性

- **🚀 异步并发**: 基于Promise.all的高效并发处理
- **🔄 智能缓存**: TTL机制的JSON缓存系统
- **🛡️ 错误容错**: 完善的异常捕获和重试机制
- **📦 模块化**: 高内聚低耦合的模块设计
- **🎯 性能优化**: 连接池、批量处理、内存管理

## 📊 性能指标

### 实测性能数据

基于最新测试结果（q.quuvv.cn域名）：

| 测试项目 | 性能指标 | 说明 |
|----------|----------|------|
| **DNS解析** | 8/9 成功率 | 9个DNS服务器中8个成功 |
| **IP获取** | 9个唯一IP | 多DNS合并去重 |
| **快速筛选** | 0.1秒 | TCP连接测试 |
| **地区识别** | 4.0秒 | 9个IP并发识别 |
| **性能测试** | 17秒 | 延迟+带宽测试 |
| **总耗时** | 48.51秒 | 完整流程 |
| **缓存效率** | 100% | 缓存命中9个条目 |

### 性能对比

#### vs Python版本
| 维度 | Node.js版本 | Python版本 | 优势 |
|------|-------------|------------|------|
| **启动速度** | ⚡ 更快 | 较慢 | V8引擎优势 |
| **内存占用** | 📉 较低 | 较高 | 事件驱动架构 |
| **并发性能** | 🚀 优秀 | 良好 | 异步I/O优势 |
| **部署便利** | ✅ 便捷 | 一般 | npm生态 |
| **错误恢复** | 🛡️ 稳定 | 一般 | 完善异常处理 |

#### 性能基准测试
- **小规模测试** (1-10个IP): ~10-20秒
- **中规模测试** (10-50个IP): ~30-60秒
- **大规模测试** (50+个IP): ~60-120秒
- **缓存命中场景**: 重复运行提升50-70%速度

## 🔧 开发指南

### 环境要求
- **Node.js**: >= 16.0.0
- **内存**: 建议 >= 256MB
- **网络**: 稳定的互联网连接
- **磁盘**: 约50MB可用空间

### 开发模式

```bash
# 安装依赖
npm install

# 开发模式运行（带调试）
npm run dev

# 查看详细日志
tail -f logs/DNSIPtest-nodejs.log
```

### 自定义配置

#### 添加自定义DNS服务器
编辑 `config/config.js`，在 `dnsServers` 数组中添加：

```javascript
{
  name: '自定义DNS',
  servers: ['8.8.8.8', '8.8.4.4'],
  critical: false
}
```

#### 修改评分算法
在 `bandwidthTester.js` 中调整评分权重：

```javascript
// 综合评分计算
const finalScore = latencyScore * 0.4 + bandwidthScore * 0.3 + stabilityScore * 0.3;
```

#### 扩展地区API
在 `geoResolver.js` 中添加新的地理位置API：

```javascript
// 添加新的API端点
const response = await httpClient.get(`https://your-api.com/${ip}`);
```

### 故障排除

#### 常见问题

1. **DNS解析失败**
   - 检查网络连接
   - 确认DNS服务器可用性
   - 查看防火墙设置

2. **地区识别API限制**
   - 程序会自动切换到备用API
   - 可在配置中添加API密钥

3. **缓存文件损坏**
   - 删除 `data/Cache-nodejs.json`
   - 程序会自动重建缓存

#### 调试技巧

```bash
# 查看实时日志
tail -f logs/DNSIPtest-nodejs.log

# 检查缓存内容
cat data/Cache-nodejs.json | jq .

# 测试DNS解析
node -e "const dns = require('dns'); dns.resolve('q.quuvv.cn', (err, addrs) => console.log(addrs))"
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔄 更新日志

### v1.0.0 (2025-11-10)
🎉 **重大更新：Node.js版本发布**

#### ✨ 新功能
- **🚀 完整Node.js移植**: 从Python版本完全重构为Node.js
- **📁 专业目录结构**: 采用src/config/data/logs分层架构
- **⚡ 性能大幅提升**: 异步I/O带来的显著性能优势
- **🔄 智能缓存系统**: 7天TTL，自动清理过期条目
- **📊 完整评分体系**: 延迟40% + 带宽30% + 稳定性30%
- **🌍 双重API保障**: ipinfo.io + ip-api.com备用机制

#### 🛠️ 技术特性
- **模块化设计**: 7个核心模块，高内聚低耦合
- **并发优化**: Promise.all + p-limit精确控制并发数
- **错误容错**: 完善的异常捕获和自动重试机制
- **日志系统**: Winston引擎，多级日志输出
- **配置管理**: 集中化配置，支持灵活定制

#### 📈 性能表现
- **DNS解析**: 9个DNS服务器并发，8/9成功率
- **IP测试**: 9个IP仅0.1秒完成快速筛选
- **地区识别**: 9个IP并发识别仅4.0秒
- **完整流程**: 48.51秒完成全流程测试
- **缓存效率**: 100%缓存命中率

#### 📋 输出文件
- **基础版**: DNSIPlist.txt + SenflareDNS.txt
- **优选版**: DNSIPlist-Pro.txt + SenflareDNS-Pro.txt
- **详细报告**: Ranking.txt (完整性能排名)
- **系统文件**: 自动缓存和日志管理

---

## 🤝 贡献指南

欢迎提交 Issues 和 Pull Requests！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📞 联系方式

- **项目地址**: https://github.com/your-repo/Senflare-DNS-IP
- **问题反馈**: 请在 Issues 中提交
- **功能建议**: 欢迎在 Discussions 中讨论

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！