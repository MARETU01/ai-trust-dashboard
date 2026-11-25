# AI Trust Observatory

**在线访问：[GitHub Pages](https://maretu01.github.io/ai-trust-dashboard/)**

本项目是 **IBA6317 / FIN6138 课程小组作业**，基于 Stack Overflow 2025 年开发者调查，通过交互式仪表板探索开发者如何使用和信任 AI，以及 AI 对开发工作流程的影响。

## 看板概览

看板包含 13 张图，围绕三个主题展开：

- **调查概况**：受访者年龄、AI 使用频率，以及不同年龄和工作经验人群的 AI 信任与学习情况。
- **工具与工作流程**：编程语言、数据库、社区平台、AI 模型，以及 AI 在开发任务中的使用情况。
- **信任与影响**：对 AI 准确性、复杂任务处理能力及就业影响的看法。

支持国家或地区、年龄、编程学习状态、开发者角色和 AI 使用频率的组合筛选，以及悬停提示、数据表查看和中英文切换。

技术栈：React、TypeScript、Vite、ECharts；网页中的数据筛选和图表交互在浏览器中完成。

## 安装和运行

### Docker 镜像部署

安装并启动 Docker，使用 Linux 容器，然后拉取 [Docker Hub 镜像](https://hub.docker.com/r/maretu01/ai-trust-dashboard)：

```bash
docker pull maretu01/ai-trust-dashboard:latest
docker run -d --name ai-trust-dashboard -p 8080:80 --restart unless-stopped maretu01/ai-trust-dashboard:latest
```

本机访问 http://localhost:8080 ；其他设备访问 `http://服务器IP:8080`，服务器需放行 TCP 8080 端口。可修改 `-p 8080:80` 左侧的端口号。

镜像包含网页和数据，部署机器只需 Docker。若需固定版本，将命令中的 `latest` 换成 `v0.2.0` 等版本标签。

更新时先拉取新版镜像，再重新创建容器：

```bash
docker pull maretu01/ai-trust-dashboard:latest
docker stop ai-trust-dashboard
docker rm ai-trust-dashboard
docker run -d --name ai-trust-dashboard -p 8080:80 --restart unless-stopped maretu01/ai-trust-dashboard:latest
```

### 本地运行

需要 Node.js 26 和 npm。

```bash
git clone https://github.com/MARETU01/ai-trust-dashboard.git
cd ai-trust-dashboard
npm ci
npm run dev
```

访问 http://localhost:6138 。仓库已包含运行所需的数据，启动时会自动生成汇总和压缩数据。

### 构建与预览

```bash
npm run build
npm run preview
```

构建产物位于 `dist/`，预览地址默认为 http://localhost:4173 。

## 数据来源

数据来自 **Stack Overflow Developer Survey 2025**，由 Stack Overflow 发布。

- [官方调查报告](https://survey.stackoverflow.co/2025/)
- [官方 2025 年数据归档](https://github.com/StackExchange/Survey/tree/main/packages/archive/2025)

项目使用的数据保存在 [`data/data.csv`](data/data.csv)，由 [`script/prepare_data.py`](script/prepare_data.py) 选取字段、处理缺失值并整理分类。各图基于筛选后的有效回答计算统计结果；多选题的比例之和可能超过 100%。
