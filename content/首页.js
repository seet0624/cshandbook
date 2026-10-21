// ═══ 首页：公告、快捷入口、「我现在要办什么」、新手第一周五课 ═══
//
// 怎么改：
//   · 文字都放在英文单引号里：'这样'。文字里本身要用单引号时，写成 \'。
//   · 每一项 { … } 之间、每个字段之间用英文逗号 , 隔开。
//   · 以 // 开头的行是说明，网站不会显示。
//   · 在 GitHub 网页上点铅笔图标编辑 → 写好后点 Commit changes，几分钟后网站自动更新。
//   · 改坏了网站顶部会出现红色提示，写明是哪个文件第几行；GitHub 也会发邮件提醒（见 README）。
//
// go：点了跳到哪一节，填章节 id（content/章节.js 里每一节开头的 id:'…'）。
//     填 'phrases' 表示跳到「话术总库」页。
// icon：图标名，可用的名字见 index.html 里的 ICONS 列表。

// 公告 · 更新提醒（显示在首页，最新的放最上面）
//   tag：左边的小标签，比如 '更新 · 16.10.2023'、'制度'、'提醒'
CS.announcements = [
  { tag:'新增 · 服务中心后台', text:'手册新增服务中心后台教程：后台下单五步、代家人与第二账号、各工具下单注意事项、报单核实模板、新名字管理、新增化解记录与工单，以及总部地址和银行账号。', go:'sb-order' },
  { tag:'流程更新', text:'更换邀约人：服务中心后台已不能申请，改由学员本人填写申请表，用登记邮箱发到 csshuyi5796@gmail.com。每宗 RM600（获批后缴付），业绩及级别清零；归还原邀约人未满半年免费、不清零。', go:'rl-apply' },
  { tag:'更新 · 16.10.2023', text:'现货牌子发货新流程：不再发现货，统一有订单编号后，由客服通知服务中心才能发货；急用牌子请提早告知处理。', go:'lg-instock' },
  { tag:'制度', text:'后台下单期限：学员完款且手续齐全后，服务中心须在 3 个工作日内下单；逾期第一次暂停权限一个月，第二次永久停止。', go:'os-train' },
  { tag:'提醒', text:'订单审核时间为工作日 9:00–11:30，仅审核前一天已付款订单；通过审核的订单于当日 12:00 结算。', go:'hq-order' }
];

// 常用快捷入口
//   title：标题  sub：下面一行小字
CS.quicklinks = [
  { title:'话术总库', sub:'全站统一口径', icon:'book-open', go:'phrases' },
  { title:'物流速查', sub:'发货 · 集运 · 包裹', icon:'truck', go:'bd-logi' },
  { title:'改邀约人／安置人', sub:'学员本人填表申请', icon:'user-round-check', go:'rl-apply' },
  { title:'停运编号对照', sub:'旧编号查现服务中心', icon:'users-round', go:'bd-team' },
  { title:'会员话术库', sub:'常问 Q&A', icon:'book-open', go:'hq-qam' },
  { title:'订单审核时间', sub:'9:00–11:30', icon:'clock', go:'hq-order' },
  { title:'工具工期', sub:'50–60 工作日', icon:'wrench', go:'os-leadtime' },
  { title:'分单流程', sub:'报单分配', icon:'list-checks', go:'hq-split' },
  { title:'电子币充值', sub:'服务中心', icon:'coins', go:'hq-topup' },
  { title:'总部地址与账号', sub:'电话 · 收件 · 银行', icon:'landmark', go:'hq-contact' }
];

// 我现在要办什么
//   t：标题  s：下面一行小字
CS.tasks = [
  { t:'学员要买工具', s:'报价 · 下单 · 付款', icon:'shopping-bag', go:'hq-buy' },
  { t:'查工具工期', s:'算出交付日', icon:'clock', go:'os-leadtime' },
  { t:'货到了 / 要发货', s:'物流全流程', icon:'truck', go:'bd-logi' },
  { t:'要改邀约人／安置人', s:'新申请流程 · RM600', icon:'user-round-check', go:'rl-apply' },
  { t:'学员问价格', s:'费用与价格总表', icon:'tag', go:'bd-fee' },
  { t:'服务中心要充电子币', s:'充值流程', icon:'coins', go:'hq-topup' },
  { t:'要报单 / 分单', s:'分配规则', icon:'list-checks', go:'hq-split' },
  { t:'不知道该说什么', s:'话术总库', icon:'message-square', go:'phrases' },
  { t:'学员问后台怎么用', s:'m.good39.com 教程', icon:'phone', go:'lb-login' }
];

// 新手第一周 · 五课（按顺序显示；这里列出的章节在侧栏会标「必读」）
//   d：第几课  id：对应章节 id  t：标题  why：为什么要学这一课
CS.week = [
  { d:'第 1 课', id:'in-roles', t:'我们服务谁', why:'先认清四类服务对象和各自的对接方式。' },
  { d:'第 2 课', id:'hq-order', t:'订单怎么走', why:'审核窗口、12:00 结算、改单时点与费用。' },
  { d:'第 3 课', id:'hq-buy', t:'学员怎么买', why:'购买条件、重复报单、定金与完款的分别。' },
  { d:'第 4 课', id:'hq-split', t:'报单怎么分', why:'按推荐上级分配，其次邀约人或团队。' },
  { d:'第 5 课', id:'hq-repair', t:'化解怎么办', why:'收件、缴款、50–60 工作日工期与领取签收。' }
];
