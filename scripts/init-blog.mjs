#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline/promises"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, "..")

if (!process.stdin.isTTY) {
  console.error("请在交互式终端中运行：node scripts/init-blog.mjs")
  process.exit(1)
}

const files = {
  site: path.join(rootDir, "site.yaml"),
  workflow: path.join(rootDir, ".github", "workflows", "deploy-pages.yaml"),
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function textBetween(text, pattern, fallback = "") {
  const match = text.match(pattern)
  return match?.[1]?.trim() || fallback
}

function parseGitHubUrl(url) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/)
  if (!match) return {}
  return { owner: match[1], repo: match[2] }
}

function defaultBaseUrl(owner, repo) {
  return repo === `${owner}.github.io` ? `${owner}.github.io` : `${owner}.github.io/${repo}`
}

function yamlQuote(value) {
  return JSON.stringify(String(value).replace(/\r?\n/g, " "))
}

async function readText(file) {
  try {
    return await readFile(file, "utf8")
  } catch (error) {
    if (error.code === "ENOENT") return ""
    throw error
  }
}

async function ask(label, defaultValue = "") {
  const suffix = defaultValue ? ` (${defaultValue})` : ""
  const answer = await rl.question(`${label}${suffix}: `)
  return answer.trim() || defaultValue
}

async function askRequired(label, defaultValue = "") {
  while (true) {
    const answer = await ask(label, defaultValue)
    if (answer) return answer
    console.log("这个字段不能为空，请重新输入。")
  }
}

function baseUrlDefault(currentBaseUrl, fallbackBaseUrl) {
  if (!currentBaseUrl || currentBaseUrl === "example.com") return fallbackBaseUrl
  return currentBaseUrl
}

function createSiteYaml({ title, baseUrl, githubUrl }) {
  return `configuration:
  pageTitle: ${yamlQuote(title)}
  baseUrl: ${yamlQuote(baseUrl)}

footerLinks:
  GitHub: ${yamlQuote(githubUrl)}
`
}

function createWorkflowYaml({ branch, factoryRepository, factoryRef }) {
  return `name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - ${branch}
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    uses: ${factoryRepository}/.github/workflows/deploy-pages.yaml@${factoryRef}
    with:
      quartz-repository: ${factoryRepository}
      quartz-ref: ${factoryRef}
      content-directory: "."
`
}

async function main() {
  const [siteYaml, workflowYaml] = await Promise.all([
    readText(files.site),
    readText(files.workflow),
  ])

  const currentTitle = textBetween(siteYaml, /pageTitle:\s*["']?([^"'\n]+)["']?/, "我的 Quartz 站点")
  const currentBaseUrl = textBetween(siteYaml, /baseUrl:\s*["']?([^"'\n]+)["']?/, "example.com")
  const currentGitHubUrl = textBetween(siteYaml, /GitHub:\s*["']?([^"'\n]+)["']?/, "")
  const currentBranch = textBetween(workflowYaml, /branches:\s*\n\s*-\s*([^\s]+)/, "master")
  const currentFactoryRepository = textBetween(
    workflowYaml,
    /quartz-repository:\s*([^\s]+)/,
    "quartz-lib/factory",
  )
  const currentFactoryRef = textBetween(workflowYaml, /quartz-ref:\s*([^\s]+)/, "master")
  const parsedGitHubUrl = parseGitHubUrl(currentGitHubUrl)

  console.log("这个脚本会把当前模板初始化为一个新的 Quartz 博客项目。")
  console.log("直接回车会使用括号中的默认值。\n")

  const title = await askRequired("站点标题", currentTitle)
  const owner = await askRequired("GitHub 用户名或组织名", parsedGitHubUrl.owner || "owner")
  const repo = await askRequired("新仓库名", parsedGitHubUrl.repo || path.basename(rootDir))
  const fallbackBaseUrl = defaultBaseUrl(owner, repo)
  const baseUrl = await askRequired(
    "站点域名（没有自定义域名时直接回车使用仓库地址，不要包含 https:// 或结尾 /）",
    baseUrlDefault(currentBaseUrl, fallbackBaseUrl),
  )
  const branch = await askRequired("部署分支", currentBranch)
  const githubUrl = `https://github.com/${owner}/${repo}`

  console.log("\n即将写入以下配置：")
  console.log(`- 站点标题：${title}`)
  console.log(`- 站点地址：https://${baseUrl}`)
  console.log(`- 仓库地址：${githubUrl}`)
  console.log(`- 部署分支：${branch}`)

  await mkdir(path.dirname(files.workflow), { recursive: true })

  await writeFile(files.site, createSiteYaml({ title, baseUrl, githubUrl }), "utf8")
  await writeFile(
    files.workflow,
    createWorkflowYaml({
      branch,
      factoryRepository: currentFactoryRepository,
      factoryRef: currentFactoryRef,
    }),
    "utf8",
  )

  console.log("\n初始化完成。下一步：")
  console.log("1. 检查生成的 site.yaml 和 .github/workflows/deploy-pages.yaml。")
  console.log(`2. 推送到 ${branch} 分支。`)
  console.log("3. 在 GitHub 仓库 Settings -> Pages 中确认 Source 为 GitHub Actions。")
}

try {
  await main()
} finally {
  rl.close()
}
