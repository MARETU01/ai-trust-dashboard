# AI Trust Observatory

基于 Stack Overflow 2025 开发者调查的纯前端仪表板。Vite 构建 React 和 TypeScript 页面，ECharts 绘制交互图。页面按调查概况、工具与工作流程、信任与影响组织 13 张图，支持组合筛选、悬停提示和展开数据表。[调查原始报告](https://survey.stackoverflow.co/2025/)

## 本地运行

在项目目录中使用 Node 和 npm。

```powershell
npm ci
npm run dev
```

## 构建

```powershell
npm run build
npm run preview
```

生产构建会运行 TypeScript 严格检查。也可以单独运行 `npm run typecheck` 检查类型。

`dist/` 是可直接托管的静态产物，包含网页、图表资源和精简数据。构建使用相对资源路径，可部署到 GitHub Pages 的仓库子目录。[Vite 静态部署说明](https://vite.dev/guide/static-deploy.html)

## GitHub Pages 部署

已配置 `.github/workflows/deploy.yml`，使用 Node.js 26 安装依赖、构建并部署 `dist/`。

1. 在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中，将 **Source** 设为 **GitHub Actions**。
2. 将项目源码、`package-lock.json`、`data/data.csv` 和 `.github/workflows/deploy.yml` 一起提交并推送到 `main` 分支。构建会自动生成 `src/generated/`，无需提交生成目录或 `dist/`。
3. 在仓库 **Actions** 页面查看 **Deploy to GitHub Pages** 的执行结果。也可以通过 **Run workflow** 手动部署。

部署成功后访问：https://maretu01.github.io/ai-trust-dashboard/ 。此后每次推送到 `main` 都会自动更新网站。

## Docker 镜像与 Docker Hub

镜像名为 `maretu01/ai-trust-dashboard`。`Dockerfile` 使用 Node.js 26 构建网页，再将 `dist/` 复制到 Nginx 镜像中，由容器的 80 端口提供网站。构建需要项目中的 `data/data.csv`，无需提前运行 npm 或提交 `dist/`。

### 本地构建和运行

先安装并启动 [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)，使用 Linux containers。在项目根目录执行：

```powershell
docker build -t maretu01/ai-trust-dashboard:latest .
docker run -d --name ai-trust-dashboard -p 8080:80 --restart unless-stopped maretu01/ai-trust-dashboard:latest
```

访问 http://localhost:8080 ，检查页面和筛选功能。查看日志使用 `docker logs ai-trust-dashboard`，停止并移除容器使用 `docker rm -f ai-trust-dashboard`。

### 首次配置 Docker Hub 自动发布

1. 打开 [Docker Hub 仓库列表](https://hub.docker.com/repositories/maretu01)，选择 **Create repository**，Namespace 选 `maretu01`，仓库名填 `ai-trust-dashboard`。如需允许他人直接拉取，Visibility 选 **Public**。
2. 在 Docker 账户的 **Account settings → Personal access tokens → Generate new token** 创建具有仓库读取、写入权限的 Token。保存 Token，不要写入项目文件。参见 [Docker Token 官方说明](https://docs.docker.com/security/access-tokens/personal-access-tokens/)。
3. 打开 GitHub 仓库 **Settings → Secrets and variables → Actions → New repository secret**，名称填 `DOCKERHUB_TOKEN`，值填上一步的 Token。工作流已固定用户名为 `maretu01`，不需要额外配置用户名。
4. 将项目源码、`data/data.csv`、`package-lock.json`、`Dockerfile`、`.dockerignore`、`docker/nginx.conf` 和整个 `.github/` 一起提交并推送到 `main`。然后按下方步骤推送版本 tag，在 **Actions → Publish Docker image** 查看验证、构建和发布结果。

构建由 GitHub 执行，使用此方式发布时本机无需安装 Docker。流程采用 [Docker 官方 GitHub Actions](https://docs.docker.com/build/ci/github-actions/)。

Docker 工作流参考 `gothrough` 的版本发布流程，仅在推送 `v*` tag 时触发；普通分支推送不会制作 Docker 镜像，也没有手动构建入口。GitHub Pages 仍在推送到 `main` 时更新。

发布前会校验 tag 格式、确认该提交已在远程 `main` 历史中，并运行标签规则测试。随后构建 amd64 测试镜像，启动容器检查首页、JS/CSS、Worker 和 gzip 调查数据；通过后才登录 Docker Hub 发布 `linux/amd64` 和 `linux/arm64` 镜像。两个阶段共用构建缓存，发布任务排队执行。

标签规则如下（版本标签保留 `v` 前缀，SHA 使用完整提交哈希）：

| 操作 | 镜像标签 |
| --- | --- |
| 推送当前最高正式版，例如 `v1.0.0` | `v1.0.0`、`sha-<完整提交哈希>`、`latest` |
| 补发较旧正式版，例如已有 `v2.0.0` 后发布 `v1.0.1` | `v1.0.1`、`sha-<完整提交哈希>`，不更新 `latest` |
| 推送预发布版，例如 `v1.1.0-beta.1` | `v1.1.0-beta.1`、`sha-<完整提交哈希>`，不更新 `latest` |

版本格式为 `v主版本.次版本.修订号`，可带 `-beta.1`、`-rc.1` 等预发布标识。不接受数字前导零、`+build` 元数据或超过 Docker 128 字符限制的版本 tag。

发布版本示例（先提交本次所有改动，再执行）：

```powershell
git switch main
git pull --ff-only origin main
git push origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

预发布时将示例中的 `v1.0.0` 换成 `v1.1.0-beta.1`。仅在本地创建 tag 不会触发 CI，需要推送 tag。修复已发布版本应使用新版本号。

`latest` 按仓库内有效正式版 Git tag 的版本号比较决定，不按 tag 创建时间或 Docker Hub 发布记录决定。如果最高版本发布失败，应修复后在 Actions 里重新执行该版本的工作流；旧版本补发仍不会更新 `latest`。新规则只适用于包含本次工作流和脚本的提交。

发布成功后可在 [Docker Hub 镜像页面](https://hub.docker.com/r/maretu01/ai-trust-dashboard/tags) 查看标签。

### 在服务器运行与更新

服务器安装 Docker 后执行；私有镜像需要先用 `docker login --username maretu01` 登录：

```powershell
docker pull maretu01/ai-trust-dashboard:latest
docker run -d --name ai-trust-dashboard -p 8080:80 --restart unless-stopped maretu01/ai-trust-dashboard:latest
```

访问 `http://服务器IP:8080`，并在服务器防火墙或云安全组放行 TCP 8080。新镜像发布后，已有容器需要重新创建才会使用新版：

```powershell
docker pull maretu01/ai-trust-dashboard:latest
docker stop ai-trust-dashboard
docker rm ai-trust-dashboard
docker run -d --name ai-trust-dashboard -p 8080:80 --restart unless-stopped maretu01/ai-trust-dashboard:latest
```

如需部署固定版本，将命令中的 `latest` 替换为 `v1.0.0` 等版本标签。只有预发布镜像时，请直接使用预发布标签，此时可能还没有 `latest`。

### 本地验证发布脚本

使用项目的 Node.js 26，无需额外安装测试依赖：

```powershell
node --test .github/scripts/image-tags.test.mjs
docker build -t ai-trust-dashboard:ci .
node .github/scripts/docker-smoke.mjs ai-trust-dashboard:ci
```

容器检查需要本机 Docker 正在运行。本机 `docker build` 默认只构建当前架构，自动工作流会同时发布 amd64 和 arm64；发布前的容器启动检查只验证 amd64。

## 数据与筛选

`npm run dev` 和 `npm run build` 都会从 `data/data.csv` 生成全样本汇总和 gzip 压缩数据。网页用汇总显示默认结果，图表接近视口时才绘制。首次应用筛选时，Web Worker 加载压缩数据并重新计算各图。顶部筛选栏包括国家或地区、年龄、编程学习状态、开发者角色和 AI 使用频率。原问卷没有性别字段。

三段正文按参考图排列 12 张图。第 0 张受访者年龄分布图可在方法说明下展开。

语言、数据库和社区平台沿用全样本 Top 10，筛选后重新计算该人群的比例。模型桑基图按受访者对模型组的共选关系计数。两张任务图都使用每项任务自己的有效回答人数。

如需从原始 CSV 重新生成精简数据，请运行 `python .\script\prepare_data.py`。源文件可以通过 `--input` 指定。更新数据后重新启动开发服务器或重新构建。
