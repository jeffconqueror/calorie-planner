# 启用电脑 / 手机同步

本站已经预置站点所有者的 Supabase 项目地址与公开客户端密钥。使用本站时无需手动填写项目配置；在电脑和手机使用同一邮箱登录，再分别开启同步。登录前不会上传记录。Fork 本仓库时请替换 `CLOUD_DEFAULT` 为自己的项目，按以下步骤配置。

## 一次性配置

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 注册／登录，并创建项目。项目归你所有；数据库密码留在 Supabase，不填写到网页、不提交到仓库。
2. 在项目 **SQL Editor** 运行同目录的 [schema.sql](schema.sql)。它建立账号隔离的私有表和有版本检查的写入函数；不能省略权限部分。
3. 在 **Authentication → Email Templates** 中，分别为 **Confirm sign up** 和 **Magic Link** 两个模板设置以下正文（覆盖首次注册与后续登录）：

   ```html
   <h2>Load 登录验证码</h2>
   <p>你的验证码是：{{ .Token }}</p>
   <p>回到 Load 网页输入验证码即可登录。</p>
   ```

   本应用使用 OTP 输入，不依赖邮件链接跳转。Supabase 的默认邮件发送只面向项目团队邮箱，并且有较低限额；你个人使用时应先用注册项目的同一邮箱在两端登录。其他邮箱／多人使用需要配置自己的 SMTP 服务。不要通过关闭邮箱验证来绕过发送限制。见 [Supabase 邮件说明](https://supabase.com/docs/guides/auth/auth-smtp) 与 [OTP 说明](https://supabase.com/docs/guides/auth/auth-email-passwordless)。

4. 从项目 Connect/API Keys 获取 **Project URL** 和 **publishable key**（`sb_publishable_…`）。网页也兼容旧版 `anon` 公钥。不要使用 `sb_secret_…`、`service_role` 或数据库密码。公钥的访问范围由登录用户和数据库权限控制，参见 [API keys](https://supabase.com/docs/guides/getting-started/api-keys)。
5. 电脑网页的「私人云端同步」中保存地址、公钥，填写邮箱并验证。先在保存完整热量规划的电脑点「开启同步并合并」。首次上传前会保留可下载的本机恢复副本。
6. 手机右上角齿轮 → 「私人云端同步」，填写相同项目配置、使用相同邮箱登录，再开启同步。后续只需正常联网打开网页。

项目 URL 和 publishable key 也可由维护者填进 `index.html` 的 `CLOUD_DEFAULT` 并重新发布，这样两端不必手动填写项目配置。只有公钥可放在那里，登录令牌永远不提交代码库。

## 合并规则

- 体重按日期、训练按场次 ID、自定义食物按食物 ID、模板按动作、力量基准按动作分别合并。
- 首次连接保留已有云端身体／饮食规划，追加独有记录。因此先连接规划最完整的电脑；手机的默认值不会覆盖它。
- 首次连接遇到两份不同的同日体重／同 ID 训练等，会列出双方内容供选择。之后同一记录的并发修改（包括修改与删除）也会暂停等待选择。
- 保存删除标记，避免旧设备重新带回已经删除的记录。写入使用数据库原子版本比较；服务端版本变化则重新读取合并。
- 请求期间新增的本机编辑会继续保留并在下一轮上传。离线仍使用原来的 localStorage / IndexedDB。
- 语言、单位、USDA 密钥、登录凭据、训练草稿和当前界面选择不上传。正在进行的训练需在原设备继续，完成后才同步。
- 恢复备份或重置会先暂停同步。核对内容后手动重新开启；不会悄悄把整份恢复操作传播到其他设备。
- 同一台设备的一个本机用户档案绑定一个云端账号。要使用另一个云端账号，应新建本机用户，避免混合私人数据。
- 修改后约 1.2 秒尝试同步；回到页面、重新联网时也尝试，页面可见时每 30 秒检查。不是后台推送服务，关闭网页时不会持续联网。

## 检查与边界

数据库安全检查会提示已登录用户可调用 `SECURITY DEFINER` 函数 `load_sync_commit`。这是有意设计的唯一写入入口，用于原子版本检查；函数只使用 `auth.uid()` 确定所有者，固定空 `search_path`，拒绝无登录请求，且撤销了 PUBLIC/anon 的执行权限。已登录用户没有表的直接写入权限。参见 [Supabase 检查说明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)。

`npm test` 验证纯合并和现有应用回归；`npm run test:cloud-db` 用本地 Postgres 引擎验证权限与原子版本检查；`npm run test:cloud` 用两份隔离浏览器状态模拟 Supabase REST，验证完整前端流程。

这些自动化测试不会注册真实账号、发送真实邮件或上传私人记录。正式启用后仍需用目标项目验证真实邮件投递和两台设备的数据往返。免费服务的额度、休眠和邮件限制以 Supabase 当前项目设置为准。
