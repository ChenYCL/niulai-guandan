(function (root) {
  "use strict";

  var STORAGE = "nl-lang";
  var LANGS = { zh: "zh-CN", ja: "ja", en: "en" };

  var dict = {
    zh: {
      "doc.title": "牛来掼蛋",
      "lobby.title": "牛来捣蛋",
      "lobby.tagline": "四人两队 · 升级争先",
      "lobby.nick": "昵称",
      "lobby.nick_ph": "怎么称呼你",
      "lobby.create": "创建房间",
      "lobby.join": "加入",
      "lobby.room_ph": "房间码",
      "lobby.hint": "人不够自动补机器人，一个人也能开打。进贡已做，无抗贡。",
      "orient.turn": "请把手机横过来",
      "orient.sub": "本桌强制横屏全屏",
      "orient.fs": "进入全屏",
      "hud.room": "房间",
      "hud.copy": "复制邀请",
      "hud.level": "当前级牌",
      "hud.wild": "逢人配 红心{n}",
      "hud.sfx": "音效",
      "hud.bgm": "背景乐",
      "hud.mic": "麦克风",
      "hud.fs": "全屏",
      "hud.fs_enter": "进入全屏",
      "hud.fs_exit": "退出全屏",
      "hud.team": "我方 {us} 级  ·  对方 {them} 级",
      "act.pass": "不出",
      "act.hint": "提示",
      "act.play": "出牌",
      "act.ready": "准备",
      "act.unready": "取消准备",
      "act.start": "开始",
      "act.return": "还贡",
      "act.continue": "继续",
      "act.auto": "托管",
      "act.unauto": "取消托管",
      "act.autotake_on": "自动接管 · 开",
      "act.autotake_off": "自动接管 · 关",
      "seat.you": "你",
      "seat.claim": "入座",
      "seat.swap": "换座",
      "swap.ask": "{name} 想和你换座位",
      "swap.accept": "接受",
      "swap.decline": "拒绝",
      "turn.left": "剩余 {s} 秒",
      "turn.soft": "{s} 秒后自动出牌",
      "toast.claimed": "已换到这个位子",
      "toast.swap_sent": "已向 {name} 请求换座",
      "toast.swap_accept": "{name} 同意换座",
      "toast.swap_decline": "{name} 拒绝换座",
      "toast.auto_on": "已托管",
      "toast.auto_off": "已取消托管",
      "toast.autotake_on": "15秒无操作将自动出牌",
      "toast.autotake_off": "已关闭自动接管",
      "toast.force_auto": "超时，已强制托管",
      "err.swap_unsafe": "现在换座不安全",
      "err.bad_seat": "座位无效",
      "err.no_swap": "没有换座请求",
      "seat.empty_av": "空",
      "seat.empty": "空位",
      "seat.partner": "队友",
      "seat.bot": "机器人",
      "seat.auto": "托管",
      "seat.online": "在线",
      "seat.offline": "离线",
      "seat.cards": "{n}张",
      "seat.ready": "已准备",
      "place.1": "头游",
      "place.2": "二游",
      "place.3": "三游",
      "place.4": "末游",
      "fx.joker4": "天王炸",
      "fx.joker3": "三王炸",
      "fx.bomb": "炸弹",
      "fx.special": "好牌",
      "fx.pass": "不出",
      "combo.single": "单张",
      "combo.pair": "对子",
      "combo.triple": "三张",
      "combo.fullhouse": "三带二",
      "combo.straight": "顺子",
      "combo.connpair": "连对",
      "combo.plate": "钢板",
      "combo.plane": "飞机",
      "combo.joker4": "天王炸",
      "combo.joker3": "三王炸",
      "combo.bomb4": "四个炸",
      "combo.bomb5": "五个炸",
      "combo.bomb6": "六个炸",
      "combo.bomb7": "七个炸",
      "combo.bomb8": "八个炸",
      "combo.bomb9": "九个炸",
      "combo.bomb10": "十个炸",
      "combo.bomb_n": "{n}个炸",
      "card.big": "大",
      "card.small": "小",
      "card.joker": "王",
      "turn.yours": "轮到你出牌",
      "turn.wait": "等待 {name} 出牌",
      "turn.opponent": "对手",
      "settle.title": "本局结算",
      "settle.champion": "打到 A 再胜 · 本队夺冠",
      "settle.up": "{kind} · 升 {up} 级 → 下一级 {next}",
      "kind.双下": "双下",
      "kind.一三": "一三",
      "kind.一四": "一四",
      "nick.default": "玩家{n}",
      "toast.need_code": "输入房间码",
      "toast.copied": "邀请链接已复制",
      "toast.reconnecting": "连接断开，正在重连",
      "toast.offline_reconnecting": "掉线了，正在重连",
      "toast.not_in_room": "还没进房间",
      "toast.ready": "已准备",
      "toast.starting": "正在开局，空位补机器人",
      "toast.only_pass": "管不上，只能不出",
      "toast.pick_cards": "请先选牌",
      "toast.illegal": "牌型不合法",
      "toast.cannot_beat": "管不上",
      "toast.pick_return": "选一张还贡",
      "toast.mic_fail": "麦克风不可用，游戏照常",
      "toast.tribute_give": "{name} 进贡",
      "toast.tribute_back": "还贡完成",
      "err.generic": "操作无效",
      "err.room_full": "房间已满",
      "err.join_fail": "加入失败",
      "err.not_in_room_refresh": "还没进房间，请刷新再进",
      "err.not_at_table": "你不在这桌",
      "err.already_playing": "已经在打了",
      "err.start_fail": "开局失败，请再点一次开始",
      "err.not_started_play": "还没开始出牌",
      "err.dealing": "正在发牌",
      "err.not_your_turn": "还没轮到你",
      "err.already_finished": "你已经打完了",
      "err.not_in_hand": "手里没有这些牌",
      "err.not_started": "还没开始",
      "err.lead_must_play": "首家出牌不能不出",
      "err.pick_return": "选一张还贡的牌",
      "err.cannot_beat": "管不上",
      "err.illegal": "牌型不合法",
      "err.pick_cards": "请先选牌"
    },
    ja: {
      "doc.title": "牛来カンダン",
      "lobby.title": "牛来カンダン",
      "lobby.tagline": "4人2チーム · 級を上げて先を取る",
      "lobby.nick": "ニックネーム",
      "lobby.nick_ph": "なんて呼ぶ？",
      "lobby.create": "部屋をつくる",
      "lobby.join": "入室",
      "lobby.room_ph": "部屋コード",
      "lobby.hint": "人が足りなければロボットが座る。ひとりでもすぐ打てる。進貢あり、抗貢なし。",
      "orient.turn": "スマホを横にしてね",
      "orient.sub": "この卓は横向き全画面",
      "orient.fs": "全画面にする",
      "hud.room": "部屋",
      "hud.copy": "招待をコピー",
      "hud.level": "いまの級牌",
      "hud.wild": "逢人配 ハート{n}",
      "hud.sfx": "効果音",
      "hud.bgm": "BGM",
      "hud.mic": "マイク",
      "hud.fs": "全画面",
      "hud.fs_enter": "全画面にする",
      "hud.fs_exit": "全画面をやめる",
      "hud.team": "味方 {us} 級  ·  相手 {them} 級",
      "act.pass": "パス",
      "act.hint": "ヒント",
      "act.play": "出す",
      "act.ready": "準備",
      "act.unready": "準備を取り消す",
      "act.start": "開始",
      "act.return": "還貢",
      "act.continue": "つづける",
      "act.auto": "オート",
      "act.unauto": "オート解除",
      "act.autotake_on": "自動接手 · オン",
      "act.autotake_off": "自動接手 · オフ",
      "seat.you": "あなた",
      "seat.claim": "座る",
      "seat.swap": "席替え",
      "swap.ask": "{name} が席を替わりたい",
      "swap.accept": "受ける",
      "swap.decline": "断る",
      "turn.left": "残り {s} 秒",
      "turn.soft": "{s} 秒後に自動で出す",
      "toast.claimed": "この席に座った",
      "toast.swap_sent": "{name} に席替えを頼んだ",
      "toast.swap_accept": "{name} が席替えに応じた",
      "toast.swap_decline": "{name} が席替えを断った",
      "toast.auto_on": "オートにした",
      "toast.auto_off": "オートをやめた",
      "toast.autotake_on": "15秒何もしなければ自動で出す",
      "toast.autotake_off": "自動接手をオフにした",
      "toast.force_auto": "時間切れ。強制オート",
      "err.swap_unsafe": "対局中は席を替えられない",
      "err.bad_seat": "その席は使えない",
      "err.no_swap": "席替えの依頼がない",
      "seat.empty_av": "空",
      "seat.empty": "空き席",
      "seat.partner": "相棒",
      "seat.bot": "ロボット",
      "seat.auto": "オート",
      "seat.online": "オンライン",
      "seat.offline": "オフライン",
      "seat.cards": "{n}枚",
      "seat.ready": "準備OK",
      "place.1": "頭遊",
      "place.2": "二遊",
      "place.3": "三遊",
      "place.4": "末遊",
      "fx.joker4": "天王炸",
      "fx.joker3": "三王炸",
      "fx.bomb": "爆弾",
      "fx.special": "役",
      "fx.pass": "パス",
      "combo.single": "単札",
      "combo.pair": "ペア",
      "combo.triple": "3枚",
      "combo.fullhouse": "三帯二",
      "combo.straight": "ストレート",
      "combo.connpair": "連対",
      "combo.plate": "钢板",
      "combo.plane": "飛行機",
      "combo.joker4": "天王炸",
      "combo.joker3": "三王炸",
      "combo.bomb4": "四つの爆弾",
      "combo.bomb5": "五つの爆弾",
      "combo.bomb6": "六つの爆弾",
      "combo.bomb7": "七つの爆弾",
      "combo.bomb8": "八つの爆弾",
      "combo.bomb9": "九つの爆弾",
      "combo.bomb10": "十の爆弾",
      "combo.bomb_n": "{n}の爆弾",
      "card.big": "大",
      "card.small": "小",
      "card.joker": "王",
      "turn.yours": "あなたの番",
      "turn.wait": "{name} の番を待っています",
      "turn.opponent": "相手",
      "settle.title": "この局の結果",
      "settle.champion": "Aまで上げてもう一勝 · このチームの優勝",
      "settle.up": "{kind} · {up}級アップ → 次は {next}",
      "kind.双下": "双下",
      "kind.一三": "一三",
      "kind.一四": "一四",
      "nick.default": "プレイヤー{n}",
      "toast.need_code": "部屋コードを入れてね",
      "toast.copied": "招待リンクをコピーした",
      "toast.reconnecting": "切れた。つなぎ直しています",
      "toast.offline_reconnecting": "落ちた。つなぎ直しています",
      "toast.not_in_room": "まだ部屋に入ってない",
      "toast.ready": "準備できた",
      "toast.starting": "開局中。空きはロボットが埋める",
      "toast.only_pass": "勝てない。パスしかない",
      "toast.pick_cards": "先に札を選んで",
      "toast.illegal": "その形は出せない",
      "toast.cannot_beat": "勝てない",
      "toast.pick_return": "還貢する札を1枚選んで",
      "toast.mic_fail": "マイクは使えないけど、卓は普通に打てる",
      "toast.tribute_give": "{name} が進貢",
      "toast.tribute_back": "還貢できた",
      "err.generic": "いまはできない",
      "err.room_full": "この部屋は満席",
      "err.join_fail": "入れなかった",
      "err.not_in_room_refresh": "まだ部屋にいない。更新してもう一度",
      "err.not_at_table": "この卓にいない",
      "err.already_playing": "もう始まってる",
      "err.start_fail": "開局できなかった。もう一度開始を押して",
      "err.not_started_play": "まだ出せない",
      "err.dealing": "配っている最中",
      "err.not_your_turn": "まだあなたの番じゃない",
      "err.already_finished": "もう上がってる",
      "err.not_in_hand": "その札は持ってない",
      "err.not_started": "まだ始まってない",
      "err.lead_must_play": "リードはパスできない",
      "err.pick_return": "還貢する札を1枚選んで",
      "err.cannot_beat": "勝てない",
      "err.illegal": "その形は出せない",
      "err.pick_cards": "先に札を選んで"
    },
    en: {
      "doc.title": "Niulai Guandan",
      "lobby.title": "Niulai Guandan",
      "lobby.tagline": "Four players, two teams — climb the ranks",
      "lobby.nick": "Nickname",
      "lobby.nick_ph": "What should we call you?",
      "lobby.create": "Create room",
      "lobby.join": "Join",
      "lobby.room_ph": "Room code",
      "lobby.hint": "Short a player? Robots sit in. You can start alone. Tribute is on; no anti-tribute.",
      "orient.turn": "Please turn your phone sideways",
      "orient.sub": "This table wants landscape and fullscreen",
      "orient.fs": "Enter fullscreen",
      "hud.room": "Room",
      "hud.copy": "Copy invite",
      "hud.level": "Level rank",
      "hud.wild": "Wild: heart {n}",
      "hud.sfx": "Sound",
      "hud.bgm": "Music",
      "hud.mic": "Mic",
      "hud.fs": "Fullscreen",
      "hud.fs_enter": "Enter fullscreen",
      "hud.fs_exit": "Exit fullscreen",
      "hud.team": "Us {us}  ·  Them {them}",
      "act.pass": "Pass",
      "act.hint": "Hint",
      "act.play": "Play",
      "act.ready": "Ready",
      "act.unready": "Unready",
      "act.start": "Start",
      "act.return": "Return tribute",
      "act.continue": "Continue",
      "act.auto": "Auto-play",
      "act.unauto": "Cancel auto",
      "act.autotake_on": "Auto-take · on",
      "act.autotake_off": "Auto-take · off",
      "seat.you": "You",
      "seat.claim": "Sit here",
      "seat.swap": "Swap",
      "swap.ask": "{name} wants to swap seats",
      "swap.accept": "Accept",
      "swap.decline": "Decline",
      "turn.left": "{s}s left",
      "turn.soft": "Auto-play in {s}s",
      "toast.claimed": "You took that seat",
      "toast.swap_sent": "Asked {name} to swap",
      "toast.swap_accept": "{name} accepted the swap",
      "toast.swap_decline": "{name} declined the swap",
      "toast.auto_on": "Auto-play on",
      "toast.auto_off": "Auto-play off",
      "toast.autotake_on": "Idle 15s will play a legal move",
      "toast.autotake_off": "Auto-takeover off",
      "toast.force_auto": "Timed out — forced into auto-play",
      "err.swap_unsafe": "Cannot swap mid-hand",
      "err.bad_seat": "That seat is invalid",
      "err.no_swap": "No swap request",
      "seat.empty_av": "—",
      "seat.empty": "Empty",
      "seat.partner": "Partner",
      "seat.bot": "Bot",
      "seat.auto": "Auto",
      "seat.online": "Online",
      "seat.offline": "Offline",
      "seat.cards": "{n} cards",
      "seat.ready": "Ready",
      "place.1": "1st",
      "place.2": "2nd",
      "place.3": "3rd",
      "place.4": "4th",
      "fx.joker4": "Heavenly kings",
      "fx.joker3": "Triple joker",
      "fx.bomb": "Bomb",
      "fx.special": "Special",
      "fx.pass": "Pass",
      "combo.single": "Single",
      "combo.pair": "Pair",
      "combo.triple": "Triple",
      "combo.fullhouse": "Full house",
      "combo.straight": "Straight",
      "combo.connpair": "Pairs run",
      "combo.plate": "Steel plate",
      "combo.plane": "Airplane",
      "combo.joker4": "Heavenly kings",
      "combo.joker3": "Triple joker",
      "combo.bomb4": "4-bomb",
      "combo.bomb5": "5-bomb",
      "combo.bomb6": "6-bomb",
      "combo.bomb7": "7-bomb",
      "combo.bomb8": "8-bomb",
      "combo.bomb9": "9-bomb",
      "combo.bomb10": "10-bomb",
      "combo.bomb_n": "{n}-bomb",
      "card.big": "Big",
      "card.small": "Little",
      "card.joker": "Joker",
      "turn.yours": "Your lead",
      "turn.wait": "Waiting on {name}",
      "turn.opponent": "the table",
      "settle.title": "Hand results",
      "settle.champion": "Won at A — this team takes the match",
      "settle.up": "{kind} · up {up} → next {next}",
      "kind.双下": "Double-down",
      "kind.一三": "1st+3rd",
      "kind.一四": "1st+4th",
      "nick.default": "Player {n}",
      "toast.need_code": "Enter a room code",
      "toast.copied": "Invite link copied",
      "toast.reconnecting": "Disconnected — reconnecting",
      "toast.offline_reconnecting": "Dropped — reconnecting",
      "toast.not_in_room": "You are not in a room yet",
      "toast.ready": "Ready",
      "toast.starting": "Dealing in — robots fill empty seats",
      "toast.only_pass": "Nothing beats that — pass",
      "toast.pick_cards": "Pick some cards first",
      "toast.illegal": "That is not a legal combo",
      "toast.cannot_beat": "Cannot beat that",
      "toast.pick_return": "Pick one card to return",
      "toast.mic_fail": "Mic unavailable — you can still play",
      "toast.tribute_give": "{name} pays tribute",
      "toast.tribute_back": "Tribute returned",
      "err.generic": "That did not work",
      "err.room_full": "Room is full",
      "err.join_fail": "Could not join",
      "err.not_in_room_refresh": "Not in a room — refresh and come back in",
      "err.not_at_table": "You are not at this table",
      "err.already_playing": "Already in a hand",
      "err.start_fail": "Could not start — tap Start again",
      "err.not_started_play": "Play has not started",
      "err.dealing": "Still dealing",
      "err.not_started": "Not started yet",
      "err.not_your_turn": "Not your turn yet",
      "err.already_finished": "You are already out",
      "err.not_in_hand": "Those cards are not in your hand",
      "err.lead_must_play": "The lead cannot pass",
      "err.pick_return": "Pick one card to return",
      "err.cannot_beat": "Cannot beat that",
      "err.illegal": "That is not a legal combo",
      "err.pick_cards": "Pick some cards first"
    }
  };

  var COMBO_KEYS = {
    "单张": "combo.single",
    "对子": "combo.pair",
    "三张": "combo.triple",
    "三带二": "combo.fullhouse",
    "顺子": "combo.straight",
    "连对": "combo.connpair",
    "钢板": "combo.plate",
    "飞机": "combo.plane",
    "天王炸": "combo.joker4",
    "三王炸": "combo.joker3",
    "四个炸": "combo.bomb4",
    "五个炸": "combo.bomb5",
    "六个炸": "combo.bomb6",
    "七个炸": "combo.bomb7",
    "八个炸": "combo.bomb8",
    "九个炸": "combo.bomb9",
    "十个炸": "combo.bomb10"
  };
  var COMBO_TYPE_KEYS = {
    single: "combo.single",
    pair: "combo.pair",
    triple: "combo.triple",
    fullhouse: "combo.fullhouse",
    straight: "combo.straight",
    connpair: "combo.connpair",
    plate: "combo.plate",
    plane: "combo.plane",
    joker4: "combo.joker4",
    joker3: "combo.joker3",
    bomb: "fx.bomb"
  };
  var PLACE_KEYS = { "头游": "place.1", "二游": "place.2", "三游": "place.3", "末游": "place.4" };
  var ERR_KEYS = {
    "管不上": "err.cannot_beat",
    "牌型不合法": "err.illegal",
    "请先选牌": "err.pick_cards",
    "操作无效": "err.generic",
    "房间已满": "err.room_full",
    "加入失败": "err.join_fail",
    "还没进房间，请刷新再进": "err.not_in_room_refresh",
    "还没进房间": "toast.not_in_room",
    "你不在这桌": "err.not_at_table",
    "已经在打了": "err.already_playing",
    "开局失败，请再点一次开始": "err.start_fail",
    "还没开始出牌": "err.not_started_play",
    "正在发牌": "err.dealing",
    "还没轮到你": "err.not_your_turn",
    "你已经打完了": "err.already_finished",
    "手里没有这些牌": "err.not_in_hand",
    "还没开始": "err.not_started",
    "首家出牌不能不出": "err.lead_must_play",
    "选一张还贡的牌": "err.pick_return",
    "选一张还贡": "toast.pick_return",
    "现在换座不安全": "err.swap_unsafe",
    "座位无效": "err.bad_seat",
    "没有换座请求": "err.no_swap"
  };

  function detect() {
    try {
      var saved = localStorage.getItem(STORAGE);
      if (saved && LANGS[saved]) return saved;
    } catch (e) {}
    var nav = "";
    try { nav = (navigator.language || navigator.userLanguage || "en").toLowerCase(); } catch (e2) {}
    if (nav.indexOf("zh") === 0) return "zh";
    if (nav.indexOf("ja") === 0) return "ja";
    return "en";
  }

  function fill(str, vars) {
    if (!vars || str == null) return str;
    return String(str).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : "";
    });
  }

  var I18N = {
    dict: dict,
    lang: detect(),
    t: function (key, vars) {
      if (!key) return "";
      var pack = dict[I18N.lang] || dict.en;
      var s = pack[key];
      if (s == null && dict.en) s = dict.en[key];
      if (s == null && dict.zh) s = dict.zh[key];
      if (s == null) s = key;
      return fill(s, vars);
    },
    setLang: function (lang) {
      if (!LANGS[lang]) return;
      I18N.lang = lang;
      try { localStorage.setItem(STORAGE, lang); } catch (e) {}
      I18N.apply();
      if (typeof root.__gdRefreshLang === "function") root.__gdRefreshLang();
    },
    apply: function () {
      var htmlLang = LANGS[I18N.lang] || "en";
      if (document.documentElement) {
        document.documentElement.lang = htmlLang;
        document.documentElement.setAttribute("data-lang", I18N.lang);
      }
      if (document.title !== undefined) document.title = I18N.t("doc.title");
      var nodes = document.querySelectorAll("[data-i18n]");
      var i;
      for (i = 0; i < nodes.length; i++) {
        nodes[i].textContent = I18N.t(nodes[i].getAttribute("data-i18n"));
      }
      nodes = document.querySelectorAll("[data-i18n-placeholder]");
      for (i = 0; i < nodes.length; i++) {
        nodes[i].setAttribute("placeholder", I18N.t(nodes[i].getAttribute("data-i18n-placeholder")));
      }
      nodes = document.querySelectorAll("[data-i18n-title]");
      for (i = 0; i < nodes.length; i++) {
        nodes[i].setAttribute("title", I18N.t(nodes[i].getAttribute("data-i18n-title")));
      }
      I18N.syncSwitcher();
    },
    syncSwitcher: function () {
      var btns = document.querySelectorAll(".lang-switch [data-lang]");
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("active", btns[i].getAttribute("data-lang") === I18N.lang);
      }
    },
    comboName: function (combo) {
      if (!combo) return "";
      if (typeof combo === "string") {
        if (COMBO_KEYS[combo]) return I18N.t(COMBO_KEYS[combo]);
        return combo;
      }
      if (combo.name && COMBO_KEYS[combo.name]) return I18N.t(COMBO_KEYS[combo.name]);
      if (combo.type === "bomb" && combo.len) {
        var bk = "combo.bomb" + combo.len;
        if ((dict.en && dict.en[bk]) || (dict.zh && dict.zh[bk])) return I18N.t(bk);
        return I18N.t("combo.bomb_n", { n: combo.len });
      }
      if (combo.type && COMBO_TYPE_KEYS[combo.type]) return I18N.t(COMBO_TYPE_KEYS[combo.type]);
      return combo.name || "";
    },
    placeName: function (place, title) {
      if (place >= 1 && place <= 4) return I18N.t("place." + place);
      if (title && PLACE_KEYS[title]) return I18N.t(PLACE_KEYS[title]);
      return title || "";
    },
    kindName: function (kind) {
      if (!kind) return "";
      var key = "kind." + kind;
      var pack = dict[I18N.lang] || dict.en;
      if ((pack && pack[key]) || (dict.en && dict.en[key]) || (dict.zh && dict.zh[key])) return I18N.t(key);
      return kind;
    },
    err: function (msg) {
      if (!msg) return I18N.t("err.generic");
      if (ERR_KEYS[msg]) return I18N.t(ERR_KEYS[msg]);
      return msg;
    }
  };

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== document && !(t.getAttribute && t.getAttribute("data-lang"))) t = t.parentNode;
      if (!t || t === document) return;
      var lang = t.getAttribute("data-lang");
      if (LANGS[lang]) {
        e.preventDefault();
        I18N.setLang(lang);
      }
    });
    I18N.apply();
  }

  root.I18N = I18N;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})(typeof window !== "undefined" ? window : this);
