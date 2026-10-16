# 电脑 / 手机同步

本站已预置项目地址和公开客户端密钥。先在保存完整规划的电脑登录并开启同步，再连接手机。登录本身不会上传记录。

## 默认邮件链接登录

1. Supabase → Authentication → URL Configuration：将 Site URL 设成 `https://jeffconqueror.github.io/calorie-planner/` 并保存。
2. 保持 custom SMTP 关闭，使用默认邮件模板。默认服务只向组织 Team 成员邮箱发信，目前每小时最多 2 封，电脑和手机共用额度。见 [官方邮件说明](https://supabase.com/docs/guides/auth/auth-smtp)。
3. 网页「私人云端同步」输入成员邮箱，点「发送登录邮件」。在同一浏览器、同一本机用户档案打开新邮件的确认／登录链接，再点「开启同步并合并」。
4. 手机入口在右上角齿轮。邮件链接应在发起登录的 Safari／Chrome 打开；邮件内置浏览器、主屏幕独立应用可能使用不同存储。

默认模板不需要修改。只有配置自定义 SMTP 后才可编辑模板；如需可选数字验证码模式，可把 `{{ .Token }}` 放进 Confirm sign up 和 Magic Link 正文，网页仍支持验证码输入。不要关闭邮箱验证来绕过邮件限制。

## 手机免邮件登录

在已登录的电脑展开「设置／修改同步密码」，输入两次至少 12 个字符的密码并保存。手机输入同一邮箱和该密码，点「使用密码登录」，再开启同步。

这是应用账号密码，不是 Supabase 后台或 GitHub 密码。密码登录不发送邮件；密码只传给项目 Auth API，不进入 localStorage、IndexedDB 或导出备份。如果项目安全设置要求近期登录或重新验证，设置密码可能仍需先完成邮件登录，应用不会关闭这些检查。

## 部署自己的副本

1. 创建自己的 Supabase 项目，在 SQL Editor 执行 [schema.sql](schema.sql)，保留全部权限与行级安全设置。
2. 按上述步骤设置自己的 Site URL。
3. 替换 `index.html` 的 `CLOUD_DEFAULT`，或在网页项目配置中填写自己的 Project URL 和 publishable key。
4. 只能使用公开 publishable key（也兼容 legacy anon）。不要提交 secret、service_role、数据库密码或登录令牌。

## 合并与恢复

- 体重按日期、训练按场次 ID、食物按 ID、模板和力量基准按动作分别合并。
- 首次连接保留已有云端规划并追加独有记录，因此先连接规划完整的电脑。同一记录有不同内容时提示选择。
- 使用删除标记防止旧设备恢复已删除记录；数据库原子版本检查防止并发覆盖。请求期间的本机修改保留并再次上传。
- 首次合并前保留本机恢复副本；导入备份和重置会暂停同步，核对后需重新开启。
- 语言、单位、USDA 密钥、登录凭据、密码、训练草稿和当前界面选择不作为同步记录上传。训练完成后才同步。
- 每个本机档案绑定一个云端账号，避免混合用户数据。
- 修改后约 1.2 秒尝试同步，回到页面和恢复网络也会尝试；页面可见时每 30 秒检查。关闭网页后不会后台同步。

## 验证与边界

`npm test` 验证合并和应用回归；`npm run test:cloud-db` 用本地 Postgres 验证权限和原子版本检查；`npm run test:cloud` 用隔离的浏览器及模拟 Auth/REST 验证链接登录、密码设置、免邮件手机登录、冲突处理、离线编辑和同步。

这些测试不修改真实用户密码、不发送真实邮件、不上传私人记录。真实设备登录仍需本人完成。

安全检查可能提示 authenticated 可执行 `SECURITY DEFINER` 函数 `load_sync_commit`。这是唯一写入入口的有意设计：所有者取自 `auth.uid()`，固定空 search_path，拒绝未登录请求，撤销 PUBLIC/anon 执行权限，authenticated 没有表的直接写入权限。见 [检查说明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)。
