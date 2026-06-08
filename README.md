# Local Codex Activity

一个完全本地、只读的 Codex token 活动热力图。它扫描本机
`~/.codex/sessions/**/*.jsonl`，不会调用官方 Profile API，也不会上传或
展示提示词、回答、线程标题等会话内容。

## 运行

要求 Node.js 22 或更高版本。

```bash
npm start
```

然后打开：

```text
http://127.0.0.1:4317
```

自定义端口或会话目录：

```bash
npm start -- --port 8080
npm start -- --sessions-dir /path/to/.codex/sessions
```

也可以使用环境变量：

```bash
PORT=8080 CODEX_SESSIONS_DIR=/path/to/sessions npm start
```

## 统计口径

日志里的 `token_count.info.total_token_usage` 是会话内累计值，不能直接逐条
相加。本工具只累计：

```text
token_count.info.last_token_usage
```

支持以下视图：

- 总 token
- 输入 token
- 输出 token
- 缓存输入 token

每个事件按照浏览器的 IANA 时区归档到本地日期。热力图展示当前周及之前
51 周，共 52 周；颜色按当前指标在此区间内的单日峰值分为四档。

## 隐私与文件访问

- HTTP 服务只监听 `127.0.0.1`。
- Codex 会话文件始终以只读模式打开。
- 不跟随会话目录中的符号链接。
- API 只返回日期、token 数、响应次数、会话数量和读取覆盖率。
- 损坏 JSON 行会被跳过并计入覆盖率，不会导致整个扫描失败。

## 测试

```bash
npm test
```

测试覆盖增量 token 解析、累计值排除、时区边界、按日聚合、缺失目录、
API 响应、路径穿越防护及热力图日期和颜色分级。

## 导出到 GitHub Profile

生成适合 GitHub README 嵌入的隐私友好 SVG：

```bash
npm run export:profile -- --output /path/to/profile-repo/assets/codex-activity.svg --timezone Asia/Shanghai
```

该 SVG 只包含 52 周每日强度等级、活跃天数和更新时间，不包含精确 token
总量、会话标题、项目路径、提示词或回答。

本机已提供同步脚本：

```bash
scripts/update-profile-readme.sh
```

它会重新生成 `assets/codex-activity.svg`，在 Profile README 仓库有变化时
提交并推送。

## 限制

- 只能统计当前仍保存在本机 session JSONL 中的事件。
- Codex 旧版本如果没有写入 `last_token_usage`，对应使用量无法恢复。
- 输入、缓存输入、输出等指标采用日志中记录的原始定义；缓存输入通常是
  输入 token 的子集，不应与输入 token 相加。
