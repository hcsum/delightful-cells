# 日本向け比較ページ：実装と検証

2026-10-14。交接：`notes/projects/delightfulcells.com/japan-seo-community-handoff-2026-10-14.md`。

## 本轮交付

- 保留工具在页面前部。强化 `/ja/compare-two-columns-in-excel` 的 title、description、H1 和 FAQ，覆盖 A 列有 B 列没有、两列不一致、顺序不同与无公式需求。
- 新增日语指南 `components/JapaneseComparisonGuide.tsx`：商品编码样本、三个比较模式的真实标记、COUNTIF / IF / EXACT 方法、工具操作与下载后的筛选方法。
- 明确结果只追加一个标记列，不会只下载缺失行；空白 A 在 missing 模式下为 True；同一行空白对空白不会在 matches 模式标记。
- 修正原有共有值示例的错误行标记。相关重复值工具使用 `localizePath` 指向对应语言页面。
- 浏览器测试发现日文 UTF-8 CSV 乱码：读取时对有效 UTF-8 CSV 指定 codepage 65001，其他编码继续走已有 fallback；classic tools 导出 CSV 添加 UTF-8 BOM，便于 Excel 直接识别。没有声称支持所有 Shift_JIS 文件。
- note 文章草稿：`note-comparison-draft-2026-10-14.md`。素材在 `assets/`；截图来自本地新版页面，不代表线上版本已更新。第二张是页面中结果说明表，不冒充 Excel 应用截图。

## 检查与结果

- `pnpm build` 通过，包含 TypeScript 检查。构建配置明确跳过 lint；不将构建称作 lint 通过。
- `pnpm test:sse`：22 / 22 通过。
- 两个比较文案组件的 Prettier 检查通过。
- 真实浏览器通过本地 CDP proxy 操作上传、选择模式、点击下载；捕获实际生成的 Blob / 文件名，用 SheetJS 重新解析输出，而非仅检查计算函数。
- CSV 和 XLSX 分别验证 duplicates / missing / matches，共 6 次下载；每次核对全部 6 行、原有 3 列、结果标记、文件扩展名和单 sheet 导出。XLSX 输入含第二张 sheet，确认输出不保留它。
- CSV 使用无 BOM UTF-8 日文列名及备注，确认读取和下载再解析均无乱码。
- 附加样本验证前后空白、大小写开关、通配符按普通字符处理、空白行。
- 日文 title / canonical / 正文、相关 `/ja/find-duplicates-in-excel` 的链接与 HTTP 200 已核对。
- 测试样本：`assets/product-comparison.csv`。第一行表头，后面六行数据；最后一行用备注保留空白比较行。

本地验证用 `pnpm start --hostname localhost --port 3100`，访问 `http://localhost:3100/ja/compare-two-columns-in-excel`。本机以 127.0.0.1 绑定时曾出现 locale header 在 rewrite 后丢失、服务端内容回退英文，改为 localhost 绑定后生产构建的日文渲染和所有浏览器检查通过；本轮没有修改 middleware。

## 地址与文本抽取：核对后的剩余工作

没有在本轮扩大修改这些页面，也没有调用付费 AI 或声称已测过其模型结果。

### `/ja/extract-state-from-address-excel`

现有代码已经使用日本都道府县指令与日本地址样本，不能再把它当作尚未本地化的美国州页面。`JAPANESE_EXTRACTION.prefecture` 明确不推断省略的都道府县；页面工具已提供上传、选列、先头三行预览、全量处理、下载流程。

下一步：

1. 经授权使用现有 AI 后端，实跑東京都、北海道、大阪府、神奈川県和省略都道府县的地址，保存实际预览、下载与失败结果。
2. 为公式方案补充适用条件，避免把固定截取 3 字或 4 字说成覆盖所有地址。
3. 将静态预期样本与实际模型输出区分，并补操作截图；保留“不是地址数据库校验”的边界。

### `/ja/extract-city-from-address-excel`

已有新宿区、横浜市中区、大阪市北区、虻田郡倶知安町样本与日本地址提示词，相关地址页链接已经本地化。下一步是实测特别区、政令指定都市的市+区、郡+町村、地名省略或无法判定的行，确认 null 与导出表现；不新增地址推断或校验功能。

### `/ja/extract-text-from-cell-excel`

操作说明已是日语，但正文样本仍是英文咖啡店反馈和英文产品名；这是本地化缺口。优先用现有工具验证后再替换样本：

- 商品说明中的型号，例如 `ワイヤレスマウス 型番 WM-4839 ブラック`，要求只提取原文型号，不把 SKU 与型号混为同一个字段。
- 备注中的金额，明确税前/含税、币种、逗号、小数、多金额时选哪个；缺失时返回 null，不推断金额。
- 解释固定位置/分隔符适合 LEFT / MID / TEXTAFTER 等公式，非固定描述可用 AI；不能承诺 AI 零误差或固定速度。
- 补充本地化长尾 `Excel 特定の文字 抽出`、上传→选列→预览→下载样例与地址相关工具链接，继续复用当前任务页。

## 发布状态

本轮只完成本地产品修改、验证、教程草稿与素材。未部署、推送或公开发布。发布前应先让线上页面包含本轮内容，再按 note 草稿插入两张图片和示例附件；无需新增页面或翻译功能。
