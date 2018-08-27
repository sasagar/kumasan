const https = require("https");
const Eris = require("eris");

// BOT_TOKEN は 自身が作成したBotの Bot token の文字を記述します。
var bot = new Eris(
  "NDgzNTcxOTA2Mzk4NzgxNDYw.DmVakQ.3OfLopHjoC0eEseQZeZGHfyFsoI"
);

// APIのURL
const url = "https://spla2.yuu26.com/coop/schedule";

let response;
const ChannelName = "ハイカラスクエア";

https
  .get(url, function(res) {
    var body = "";
    res.setEncoding("utf8");
    res.on("data", function(chunk) {
      body += chunk;
    });
    res.on("end", function(chunk) {
      // body の値を json としてパースしている
      res = JSON.parse(body);
      response = res.result;
    });
  })
  .on("error", function(e) {
    console.log(e.message);
  });

bot.on("ready", () => {
  // bot が準備できたら呼び出されるイベントです。
  //console.log("Ready!");

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
});

bot.on("messageCreate", msg => {
  // 誰かがメッセージ(チャット)を発言した時に呼び出されるイベントです。
  if (msg.content === "!ping") {
    // '!Ping' というメッセージを受け取ったら 'Pong!' と発言する。
    bot.createMessage(msg.channel.id, "Pong!");
  } else if (msg.content === "!pong") {
    // '!Pong' というメッセージを受け取ったら 'Ping!' と発言する。
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
    embed: embeds
  };

  return content;
};

// 日付のフォーマット
function datetostr(date, format, is12hours) {
  var weekday = ["日", "月", "火", "水", "木", "金", "土"];
  if (!format) {
    format = "YYYY/MM/DD(WW) hh:mm:dd";
  }
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var weekday = weekday[date.getDay()];
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var secounds = date.getSeconds();

  var ampm = hours < 12 ? "AM" : "PM";
  if (is12hours) {
    hours = hours % 12;
    hours = hours != 0 ? hours : 12; // 0時は12時と表示する
  }

  var replaceStrArray = {
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

  var replaceStr = "(" + Object.keys(replaceStrArray).join("|") + ")";
  var regex = new RegExp(replaceStr, "g");

  ret = format.replace(regex, function(str) {
    return replaceStrArray[str];
  });

  return ret;
}
