const https = require("https");
const token = require("./token.js");

// BOT_TOKEN は 自身が作成したBotの Bot token の文字を記述します。
// token.jsでは以下のコードが書かれている
/*
const Eris = require("eris");

exports.bot = () => {
  const bot = new Eris("YOUR_TOKEN");
  return bot;
};
*/

let bot = token.bot();

// APIのURL
const url = "https://spla2.yuu26.com/coop/schedule";

let response;
const ChannelName = "ハイカラスクエア";

https
  .get(url, function(res) {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", function(chunk) {
      body += chunk;
    });
    res.on("end", function(chunk) {
      // body の値を json としてパース
      res = JSON.parse(body);
      response = res.result;
    });
  })
  .on("error", function(e) {
    console.log(e.message);
  });

bot.on("ready", () => {
  // bot が準備できたら呼び出される
  //console.log("Ready!");

  const now = new Date();
  const start = new Date(response[0].start);
  if (
    (now.getTime() + 65 * 60 * 1000 >= start.getTime() &&
      now.getTime() + 5 * 60 * 1000 <= start.getTime()) ||
    now.getTime() + 11.9 * 60 * 60 * 1000 <= start.getTime()
  ) {
    // 全サーバに送り出す処理
    const promise = new Promise((resolve, reject) => {
      bot.guilds.forEach(guild => {
        guild.channels.forEach(channel => {
          if (channel.name === ChannelName) {
            // この辺りでresolve必要っぽそう
            const content = generateShiftFormat(response[0]);
            resolve(bot.createMessage(channel.id, content));
          }
        });
      });
    });

    // 順番に処理
    promise
      .then(() => {
        bot.disconnect();
        process.exit(0);
      })
      .catch(e => {
        console.log(e);
        process.exit(1);
      });
  } else {
    bot.disconnect();
    process.exit(0);
  }
});

// Discord に接続します。
bot.connect();

// メッセージを作る
const generateShiftFormat = data => {
  const now = new Date();
  const start = new Date(data.start);
  const end = new Date(data.end);
  const start_f = datetostr(start, "MM/DD(WW) hh:mm", false);
  const end_f = datetostr(end, "MM/DD(WW) hh:mm", false);
  let msg;
  if (now.getTime() >= start.getTime()) {
    msg = "ただいま募集中のシフトのお知らせです";
  } else if (now.getTime() + 60 * 60 * 1000 > start.getTime()) {
    msg = "まもなく始まるシフトのお知らせです";
  } else {
    msg = "次のシフトのお知らせです";
  }
  const embeds = {
    color: parseInt("e55833", 16),
    image: {
      url: data.stage.image
    },
    fields: [
      {
        name: "シフト",
        value: start_f + " ～ " + end_f
      },
      {
        name: "ステージ",
        value: data.stage.name
      },
      {
        name: "支給ブキ",
        value:
          data.weapons[0].name +
          "・" +
          data.weapons[2].name +
          "・" +
          data.weapons[1].name +
          "・" +
          data.weapons[3].name
      }
    ]
  };
  const content = {
    content: msg,
    embed: embeds
  };

  return content;
};

// 日付のフォーマット
const datetostr = (date, format, is12hours) => {
  let wdays = ["日", "月", "火", "水", "木", "金", "土"];
  if (!format) {
    format = "YYYY/MM/DD(WW) hh:mm:dd";
  }
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let weekday = wdays[date.getDay()];
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let secounds = date.getSeconds();

  let ampm = hours < 12 ? "AM" : "PM";
  if (is12hours) {
    hours = hours % 12;
    hours = hours != 0 ? hours : 12; // 0時は12時と表示する
  }

  let replaceStrArray = {
    YYYY: year,
    Y: year,
    MM: ("0" + month).slice(-2),
    M: month,
    DD: ("0" + day).slice(-2),
    D: day,
    WW: weekday,
    hh: ("0" + hours).slice(-2),
    h: hours,
    mm: ("0" + minutes).slice(-2),
    m: minutes,
    ss: ("0" + secounds).slice(-2),
    s: secounds,
    AP: ampm
  };

  let replaceStr = "(" + Object.keys(replaceStrArray).join("|") + ")";
  let regex = new RegExp(replaceStr, "g");

  ret = format.replace(regex, function(str) {
    return replaceStrArray[str];
  });

  return ret;
};
