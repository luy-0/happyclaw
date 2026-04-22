#!/bin/bash
# vercel-helper.sh — Vercel 项目管理辅助脚本
# 通过 REST API 操作，零依赖（只需 curl + jq）
set -euo pipefail

API="https://api.vercel.com"

# Token 检测
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "❌ VERCEL_TOKEN 环境变量未设置"
  echo ""
  echo "配置方法："
  echo "  1. HappyClaw Web 界面 → Settings → Claude 配置 → 自定义环境变量"
  echo "  2. 添加 VERCEL_TOKEN = <你的token>"
  echo "  3. 重启容器生效"
  echo ""
  echo "临时使用: export VERCEL_TOKEN=<token>"
  exit 1
fi

AUTH="Authorization: Bearer $VERCEL_TOKEN"

api_get() {
  curl -sf -H "$AUTH" "${API}${1}" 2>/dev/null
}

cmd="${1:-check}"
shift 2>/dev/null || true

case "$cmd" in
  check)
    echo "🔍 检查 Vercel Token..."
    result=$(api_get "/v2/user" 2>/dev/null) || {
      echo "❌ Token 无效或网络不通"
      exit 1
    }
    username=$(echo "$result" | jq -r '.user.username // "unknown"')
    name=$(echo "$result" | jq -r '.user.name // "unknown"')
    email=$(echo "$result" | jq -r '.user.email // "unknown"')
    echo "✅ 连接成功"
    echo "   用户: $name ($username)"
    echo "   邮箱: $email"
    ;;

  ls)
    echo "📦 项目列表："
    result=$(api_get "/v9/projects?limit=50")
    echo "$result" | jq -r '.projects[] | "  \(.name)\t\(.framework // "unknown")\t\(.updatedAt / 1000 | strftime("%Y-%m-%d %H:%M"))"' | column -t -s$'\t'
    ;;

  deployments)
    project="${1:-}"
    url="/v6/deployments?limit=15"
    [ -n "$project" ] && url="${url}&projectId=$(api_get "/v9/projects/${project}" | jq -r '.id')"
    echo "🚀 最近部署："
    result=$(api_get "$url")
    echo "$result" | jq -r '.deployments[] | "  \(.url // .uid)\t\(.state)\t\(.created / 1000 | strftime("%Y-%m-%d %H:%M"))\t\(.meta.githubCommitMessage // "-" | .[0:50])"' | column -t -s$'\t'
    ;;

  logs)
    deployment="${1:?用法: logs <部署URL或ID>}"
    # 提取 deployment id（如果给的是 URL）
    deployment="${deployment#https://}"
    deployment="${deployment#http://}"
    echo "📋 部署日志 ($deployment)："
    npx --yes vercel@latest logs "$deployment" --token="$VERCEL_TOKEN" 2>/dev/null || {
      echo "⚠️  npx vercel logs 失败，尝试 REST API..."
      api_get "/v2/deployments/${deployment}/events" | jq -r '.[] | "\(.created | strftime("%H:%M:%S")) [\(.type)] \(.text // .payload.text // "")"' 2>/dev/null || echo "无法获取日志"
    }
    ;;

  env-ls)
    project="${1:?用法: env-ls <项目名>}"
    echo "🔐 环境变量 ($project)："
    result=$(api_get "/v9/projects/${project}/env")
    echo "$result" | jq -r '.envs[] | "  \(.key)\t\(.target | join(","))\t\(.type)"' | column -t -s$'\t'
    ;;

  inspect)
    deployment="${1:?用法: inspect <部署URL或ID>}"
    deployment="${deployment#https://}"
    deployment="${deployment#http://}"
    echo "🔎 部署详情 ($deployment)："
    result=$(api_get "/v13/deployments/${deployment}")
    echo "$result" | jq '{
      name: .name,
      url: .url,
      state: .readyState,
      created: (.created / 1000 | strftime("%Y-%m-%d %H:%M:%S")),
      target: .target,
      framework: .projectSettings.framework,
      nodeVersion: .projectSettings.nodeVersion,
      regions: .regions,
      buildDuration: (if .buildingAt and .ready then ((.ready - .buildingAt) / 1000 | tostring + "s") else "N/A" end)
    }'
    ;;

  domains)
    project="${1:?用法: domains <项目名>}"
    echo "🌐 域名 ($project)："
    result=$(api_get "/v9/projects/${project}/domains")
    echo "$result" | jq -r '.domains[] | "  \(.name)\t\(.redirect // "-")\t\(.verified)"' | column -t -s$'\t'
    ;;

  api)
    endpoint="${1:?用法: api <endpoint>}"
    api_get "$endpoint" | jq .
    ;;

  *)
    echo "用法: vercel-helper.sh <命令> [参数]"
    echo ""
    echo "命令:"
    echo "  check                  检查 Token 有效性"
    echo "  ls                     列出所有项目"
    echo "  deployments [项目名]   查看最近部署"
    echo "  logs <部署URL>         查看部署日志"
    echo "  env-ls <项目名>        列出环境变量"
    echo "  inspect <部署URL>      部署详情"
    echo "  domains <项目名>       域名列表"
    echo "  api <endpoint>         调用 REST API"
    ;;
esac
