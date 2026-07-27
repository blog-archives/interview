# Quartz Content Template

这是一个 Quartz 内容仓库模板，用于和 [`quartz-lib/factory`](https://github.com/quartz-lib/factory) 中的公共构建逻辑配合使用。

## 目录结构

- `content/`：站点的 Markdown 内容。
- `site.yaml`：站点标题、域名、页脚链接等差异配置。
- `scripts/init-blog.mjs`：把模板一键初始化为新博客项目的交互式脚本。
- `.github/workflows/deploy-pages.yaml`：通过 GitHub Actions 构建并部署到 GitHub Pages。

## 初始化新博客

克隆或使用这个模板创建新仓库后，运行：

```sh
node scripts/init-blog.mjs
```

脚本会通过问答形式写入以下信息：

- 站点标题。
- GitHub 用户名或组织名。
- 新仓库名。
- 站点域名，或直接使用 GitHub Pages 仓库地址。
- 部署分支。

脚本会根据用户名和仓库名生成仓库地址。站点域名可以填写自定义域名；如果没有自定义域名，直接回车会使用 GitHub Pages 仓库地址。脚本只更新 `site.yaml` 和 `.github/workflows/deploy-pages.yaml`。

## 日常使用

1. 在 `content/` 中编写 Markdown 内容。
2. 修改 `site.yaml`：
   - `configuration.pageTitle`：站点标题。
   - `configuration.baseUrl`：站点地址，不要包含 `https://` 或结尾 `/`。有自定义域名时填 `example.com`，没有时填 `owner.github.io/repo`。
   - `footerLinks.GitHub`：当前内容仓库地址。
3. 在仓库 Settings -> Pages 中，将 Source 设置为 GitHub Actions。

推送到 workflow 中配置的部署分支后，workflow 会调用 `quartz-lib/factory` 中的可复用构建流程生成并部署站点。
