# 棚 tana — 多楼层药妆店找货

React / Vite 静态前端，直接连接 Supabase，部署到 GitHub Pages。顾客无需登录，查看商品楼层、货架面和层数。

## 当前功能

- 中文、日文、品牌、别名及 JAN 搜索，商品多位置展示。
- B1 / 1F / 2F 演示门店，SVG 2D 与按需加载的 3D 地图。
- 商品分享链接、楼层切换、核实时间和设施连接说明。
- Supabase RLS、位置约束、版本冲突检测、原子 CSV 新增及布局更新 RPC。
- 仅开发环境可用的本地管理员页面：编辑、发布/停用、图片压缩上传、导入预览及 JSON 导出。
- 网络失败时使用七天内公开目录缓存，明确提示历史数据。

演示店、包装示意和 JAN 数据均为虚构，不代表真实陈列或库存。完整任务和实店验收见 [TODO.md](TODO.md)。

## 本地启动

需要 Node.js 24。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

两项环境变量都留空时为本地演示；配置专用项目时填写：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

服务端 secret / service_role 密钥永远不能进入前端。只配置一个变量会显示错误。

## 数据库安装

在新的专用项目 SQL Editor 依次执行：

1. `supabase/schema.sql`（建表、约束、RLS、Storage）
2. `supabase/hardening.sql`（版本、导入、布局事务）
3. 如果 Dashboard 启用了自动 RLS，执行 `supabase/restrict-auto-rls.sql` 撤销系统生成函数的客户端执行权限。
4. `supabase/finite-layout.sql`（有限坐标和必填名称约束）
5. `supabase/protect-floor-links.sql`（防止删除被连接设施引用的楼层）
6. `supabase/update-timestamps.sql`（维护更新时间与现场核实时间分离）
7. `supabase/protect-access-points.sql`（保护被其他楼层引用的连接点）
8. `supabase/migrations/20261015140501_product_active.sql`（商品停用及其公开读取策略）
9. `supabase/seed.sql`（可选，明确标注的演示门店）

建表与各迁移仅安装一次。种子使用固定演示 ID、幂等新增，不覆盖已有记录。重新生成种子及可预览导入的 CSV：`node scripts/generate-seed.mjs`。虚拟采集规则与演练范围见 [虚拟试点](pilot/virtual-pilot.md)。

`stores → floors → shelves → product_locations` 保存位置；商品属于门店，同商品支持多个位置。楼层连接点通过 group_code 对应同一设施，用 connects_to 明确实际停靠楼层，direction 记录通行方向。

## 管理

本地访问 `http://127.0.0.1:5173/#admin`。生产构建不包含管理页面。管理登录会话只在内存保留，不存入浏览器缓存，也不与顾客客户端共享。

在 Dashboard 创建管理员账号，再用 SQL 分配门店权限：

```sql
insert into public.store_admins(user_id,store_id)
values ('YOUR_AUTH_USER_UUID','demo');
```

授权关系无法由客户端自行修改。新增门店先通过 Dashboard 创建，再分配管理员；页面可维护已授权门店和其楼层。操作失败保留输入；冲突时刷新并重新核对，不覆盖新版本。

Auth → Sign In / Providers 关闭 Allow new users to sign up，保留 Email 登录；管理账号由 Dashboard 创建，顾客继续匿名读取公开数据。

CSV 使用数据库字段名作为表头，含 id，最多 200 行；数组用 `|` 分隔，布尔用 true / false，核实时间用带时区 ISO。导入只新增：重复或无效记录会使整批回滚。批量坐标调整可调用 `update_layout(rows)`，每项含 id、version、x、z、width、depth、rotation，任何冲突整批回滚。

图片存入 `product-images/门店ID/随机ID.webp`，只允许管理员写所属门店路径。上传前客户端压缩，桶限制 2MB 和 JPG/PNG/WebP。公共图片 URL 可被任何人访问，只能上传许可素材。

停用商品或位置使用「有效 → 否」，保留原关联及核实记录；商品停用后搜索和旧分享链接均不再公开其位置。管理界面不提供危险删除，数据库仍通过外键保护已被引用的记录。

## 验证

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

浏览器测试使用独立端口 5180 和模拟 Supabase API，不读写真实项目；实际开发端口 5173 可连接真实 Supabase。测试覆盖搜索、跨层定位、旧链接、刷新、手机宽度、3D、断网缓存和管理冲突；实机和实店核对仍需进行。

手机地图默认允许页面纵向滚动。2D 放大后点击「拖动地图」启用地图手势；3D 点击「操作 3D 地图」后启用旋转和双指缩放，点击「允许页面滚动」退出操作。桌面 3D 默认可操作，恢复全层视图会重置相机。

真实公开 API 验证：`node --env-file=.env.local scripts/verify-api.mjs`。管理员隔离与事务验证使用 `supabase/verify-permissions.sql`，所有测试变化会回滚。脚本依赖原始演示种子，仅在专用试点项目执行。

## GitHub Pages

目标仓库：`https://github.com/qqke/vrstore`。

在 Settings → Pages 设置 Source 为 GitHub Actions。配置仓库 Actions Variables：VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY（公开客户端配置）。推送 main 后检查与构建通过才部署，base 固定为 `/vrstore/`，分享使用 hash 路由。

预期地址：`https://qqke.github.io/vrstore/`。只有实际部署成功才视为已上线。顾客数据直接来自 Supabase，调整商品不用重新构建；更改前端或环境变量需要重新部署。

发布后运行 `node scripts/verify-pages.mjs` 做只读验收，覆盖真实子路径、分享链接、刷新、前进后退、别名搜索、手机模拟、3D 失败降级及历史缓存；报告写入被 Git 忽略的 `.backups/pages-report.json`。本机可设置 `PLAYWRIGHT_CHANNEL=chrome` 使用已安装 Chrome。脚本不登录或修改真实数据。

可设置 `PAGES_VERIFY_URL=http://127.0.0.1:5182/vrstore/` 对本机生产预览运行同一验收；报告保留实际被测 URL，本地通过不代表公开 Pages 已更新。

每次成功或失败均覆盖验收报告；失败记录原因并返回非零退出码，避免沿用旧成功记录。检查同时确认样式表已生效。

GitHub Pages 对商业业务 / SaaS 及敏感交易有限制，正式商业运营前核对用途，必要时迁移静态托管，不需要因此增加自建后端。

## 维护和恢复

- 位置至少每周核实，促销或陈列变化立即更新；编辑时间不等于核实时间。
- 大规模修改前备份并下线门店，核实后重新发布。
- JSON 导出仅导出当前可读表，不替代数据库完整备份；Storage 图片必须单独备份。
- 恢复先在隔离项目安装 schema/hardening，再按门店、楼层、货架、商品、位置、连接点顺序导入并恢复图片，确认权限和关联后切换项目配置。
- 表快照不包含 Auth 账号或密码；目标项目需要先创建管理账号，再重新授权，不直接复用来源项目的用户 UUID。
- 前端回滚：恢复最近已验证 commit 并重新运行 Pages workflow；数据库变更另行恢复，前端回滚不恢复数据库。
- 撤权：删除对应 store_admins 关系，验证后续 API 写操作被拒绝。
- 缓存仅用于已访问页面的降级，不支持断网首次访问。已公开数据无法从用户已保存的副本中收回。
- 当前客户端目录读取上限为每表 5000 条，达到上限会拒绝不完整目录；更大规模需实现分页。
- 公开数据可被抓取，前端限流不能防御恶意流量，需监测服务额度。
- 当前免费方案未开启泄漏密码检测；该功能需要 Pro 或以上套餐，不自动升级。请使用独立强密码；正式运营前评估管理员 MFA。参考：https://supabase.com/docs/guides/auth/password-security

### 私有快照及独立图片备份

批量修改前可运行 `node --env-file=.env.local scripts/backup-before-change.mjs`。先在本机配置 PostgreSQL 的 `PGHOST`、`PGUSER`、`PGDATABASE`、`PGSSLMODE=require`，通过本机密码文件认证；不要把密码或连接字符串贴入命令、聊天或仓库。`PSQL_BIN` 可指定已安装的 psql 完整路径。命令仅接受 vrstore 项目连接，在同一只读事务取得应用表快照和完整 Storage 清单，复用图片下载校验，写入新的 `.backups/before-change-时间戳/`，不覆盖已有备份。

只有目录中存在 `complete.json` 才表示整个命令完成；该文件记录数量和快照/清单哈希，图片清单另含逐文件哈希。失败目录保留供排查，不能作为完成凭据。执行期间停止其他维护人员修改数据和图片，确认完成后才批量修改；备份目录保持私有，并另复制到设备外。此命令不包含 Auth、角色或平台配置，不替代下述完整数据库备份及恢复演练。

通过可信 SQL 连接运行 `supabase/backup-catalog.sql`，将结果保存为被 Git 忽略的 `.backups/catalog.json`，格式为 `{ "capturedAt": "实际时间", "tables": { ...SQL 返回的 snapshot... } }`。大范围修改前另存带时间戳副本，保留原快照。此快照不包含 Auth 密码，不能代替平台级完整备份。

Storage 必须另外通过可信 SQL 连接运行 `supabase/backup-storage-index.sql` 取得完整对象清单，保存返回的 inventory 为 `.backups/storage-inventory.json`。不要用匿名 Storage 列表推断整个桶为空。然后运行：

```sh
node --env-file=.env.local scripts/backup-images.mjs backup .backups/storage-inventory.json .backups/images-TIMESTAMP
node scripts/backup-images.mjs restore .backups/images-TIMESTAMP .backups/images-restored-TIMESTAMP
```

图片备份从公开桶逐一下载，按文件记录 SHA-256、长度和原对象路径；下载失败不会生成完成清单，已有目录不会被覆盖。恢复命令先验证全部哈希，再恢复到独立本地目录，不上传或覆盖线上图片。真实 Supabase Storage 的重新上传与商品 URL 切换需在隔离项目另行验收。备份只放在私有位置，并另存到设备外的私有存储。

### 本地隔离恢复实验室

安装 PostgreSQL 后，在独立数据目录初始化测试集群，只监听 127.0.0.1:55432；不要使用生产数据库。然后运行 `node scripts/verify-restore.mjs`。Windows 默认使用 PostgreSQL 18 的安装路径，其他路径可设置 `PG_BIN`。

该脚本会创建独立的 `vrstore_restore_时间戳` 数据库，依次安装表结构与迁移、恢复私有应用快照，检查数量、权限、原子布局、商品停用及下线/重新发布，然后删除自己创建的临时数据库。Auth 和 Storage 的 SQL 接口为本地模拟，不包含真实密码、对象服务或平台配置，因此不等同于完整项目灾难恢复。

`node scripts/verify-restore.mjs --demo` 使用公开虚拟目录，不读取私有快照；GitHub Actions 使用隔离 PostgreSQL 18 服务运行此检查，失败会阻止发布。

官方参考：[Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[Vite 部署](https://vite.dev/guide/static-deploy.html)、[Supabase 密钥](https://supabase.com/docs/guides/getting-started/api-keys)、[Storage 权限](https://supabase.com/docs/guides/storage/security/access-control)、[备份](https://supabase.com/docs/guides/platform/backups)。
