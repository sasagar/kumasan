const https = require('https');
//const token = require('./token.js');
const AWS = require('aws-sdk');
const Eris = require('eris');

// BOT_TOKEN は 自身が作成したBotの Bot token の文字を記述します。
// token.jsでは以下のコードが書かれている
/*

exports.bot = () => {
  const bot = new Eris("YOUR_TOKEN");
  return bot;
};
*/

// APIのURL
const url = 'https://spla2.yuu26.com/coop/schedule';

// dynamoDBに関連した処理
const docClient = new AWS.DynamoDB.DocumentClient({
	region: 'ap-northeast-1',
	apiVersion: '2012-08-10',
	accessKeyId: process.env.DYNAMO_API_ACCESS_KEY,
	secretAccessKey: process.env.DYNAMO_USER_SECRET_ACCESS_KEY
});

let response;
const ChannelName = 'クマサン商会';

exports.handler = (event, context) => {
	// lambdaでは保持される部分があるので、短時間Cronに耐えられるよう毎回handlerないでbotを生成
	let bot = new Eris(process.env.DISCORD_TOKEN);

	https
		.get(url, res => {
			let body = '';
			res.setEncoding('utf8');
			res.on('data', chunk => {
				body += chunk;
			});
			res.on('end', () => {
				// body の値を json としてパース
				res = JSON.parse(body);
				response = res.result;
			});
		})
		.on('error', e => {
			console.log(e.message);
		});

	bot.on('ready', async () => {
		// bot が準備できたら呼び出される
		//console.log("Ready!");

		const now = new Date();
		const start = new Date(response[0].start);
		const end = new Date(response[0].end);
		//const nextStart = new Date(response[1].start);
		//const nextEnd = new Date(response[1].end);
		console.info('now: ' + now.getTime());
		console.info('start: ' + start.getTime());
		console.info('end: ' + end.getTime());

		// dynamoDBから前回処理のデータを取得
		let item = await getFromDynamo();
		console.info('flag: ' + item.flag);
		console.info('nextTime: ' + item.nextTime);

		let msg;

		// nextTimeを過ぎて居たらメッセージ送信
		if (item.nextTime <= now.getTime()) {
			switch (item.flag) {
			case 'anHour2Start':
				console.info('開始1時間前処理');
				msg =
						'やあ  もうすぐ  アルバイトの募集を  はじめるよ  希望者は  そろそろ準備しておくといい';
				await sendMessage(response[0], msg);
				await updateDynamo(start.getTime(), 'start', now);
				break;

			case 'start':
				console.info('開始時間処理');
				msg =
						'サーモンランが  はじまったよ...  今回の現場、支給ブキを  しっかり確認してくれたまえ';
				await sendMessage(response[0], msg);
				await updateDynamo(
					end.getTime() - 2 * 60 * 60 * 1000,
					'2Hour2End',
					now
				);
				break;

			case '2Hour2End':
				console.info('終了2時間前処理');
				msg =
						'ふむ  あと2時間で  しめきらせてもらうからね...  ほうしゅうの受け取りを  忘れてはいけないよ';
				await sendMessage(response[0], msg);
				await updateDynamo(end.getTime(), 'end', now);
				break;

			case 'end':
				console.info('終了時処理');
				msg =
						'おつかれさま、バイトの募集は  しめきらせて  もらったよ...  次もまた  よろしくたのむよ';
				if (start.getTime() > now.getTime()) {
					console.info('最新データ利用');
					await sendMessage(response[0], msg);
					await updateDynamo(
						start.getTime() - 1 * 60 * 60 * 1000,
						'anHour2Start',
						now
					);
				} else {
					console.info('次回データ利用');
					await sendMessage(response[1], msg);
					let nextStart = new Date(response[1].start);
					await updateDynamo(
						nextStart.getTime() - 1 * 60 * 60 * 1000,
						'anHour2Start',
						now
					);
				}
				break;
			}
			await bot.disconnect();
			context.succeed('正常終了');
		} else {
			console.info('通知なし');
			await bot.disconnect();
			context.succeed('正常終了');
		}
	});

	// Discord に接続します。
	bot.connect();

	// DBから読み出す
	const getFromDynamo = async () => {
		const params = {
			TableName: 'kumasan',
			Key: {
				//取得したい項目をプライマリキー(及びソートキー)によって１つ指定
				_id: 'last_log'
			}
		};

		return new Promise((resolve, reject) => {
			docClient.get(params, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data.Item);
				}
			});
		});
	};

	// DBのアップデート
	const updateDynamo = (nextTime, flag, now) => {
		const params = {
			TableName: 'kumasan',
			Key: {
				//更新したい項目をプライマリキー(及びソートキー)によって１つ指定
				_id: 'last_log'
			},
			ExpressionAttributeNames: {
				'#f': 'flag',
				'#n': 'nextTime',
				'#u': 'updateTime'
			},
			ExpressionAttributeValues: {
				':newFlag': flag, //flagの値
				':nextTime': nextTime, //実行したい時間
				':updateTime': now.getTime() //実行したい時間
			},
			UpdateExpression: 'SET #f = :newFlag, #n = :nextTime, #u = :updateTime'
		};
		return docClient.update(params).promise();
	};

	// exitまでの大まかな処理
	const sendMessage = (res, msg) => {
		return new Promise((resolve, reject) => {
			try {
				bot.guilds.forEach(guild => {
					guild.channels.forEach(channel => {
						if (channel.name === ChannelName) {
							const content = generateShiftFormat(res, msg);
							resolve(bot.createMessage(channel.id, content));
						}
					});
				});
			} catch (e) {
				reject(e);
			}
		});
	};

	// メッセージを作る
	const generateShiftFormat = (data, msg = '') => {
		//const now = new Date();
		const start = new Date(data.start);
		const end = new Date(data.end);
		const start_f = datetostr(start, 'MM/DD(WW) hh:mm', false);
		const end_f = datetostr(end, 'MM/DD(WW) hh:mm', false);

		let embeds = {
			color: parseInt('e55833', 16),
			fields: [
				{
					name: 'シフト',
					value: start_f + ' ～ ' + end_f
				}
			]
		};

		// 時間によっては次の時間のシフト・ステージが不明の可能性があるので、その対応
		if (data.stage) {
			embeds.fields.push({ name: 'ステージ', value: data.stage.name });
			embeds.image = { url: data.stage.image };
		} else {
			embeds.fields.push({ name: 'ステージ', value: '未定' });
		}

		if (data.weapons) {
			embeds.fields.push({
				name: '支給ブキ',
				value:
					'・ ' +
					data.weapons[0].name +
					'\n・ ' +
					data.weapons[1].name +
					'\n・ ' +
					data.weapons[2].name +
					'\n・ ' +
					data.weapons[3].name
			});
		} else {
			embeds.fields.push({ name: '支給ブキ', value: '未定' });
		}

		const content = {
			content: msg,
			embed: embeds
		};

		return content;
	};

	// 日付のフォーマット
	const datetostr = (date, format, is12hours) => {
		let wdays = ['日', '月', '火', '水', '木', '金', '土'];
		if (!format) {
			format = 'YYYY/MM/DD(WW) hh:mm:dd';
		}
		let year = date.getFullYear();
		let month = date.getMonth() + 1;
		let day = date.getDate();
		let weekday = wdays[date.getDay()];
		let hours = date.getHours();
		let minutes = date.getMinutes();
		let secounds = date.getSeconds();

		let ampm = hours < 12 ? 'AM' : 'PM';
		if (is12hours) {
			hours = hours % 12;
			hours = hours != 0 ? hours : 12; // 0時は12時と表示する
		}

		let replaceStrArray = {
			YYYY: year,
			Y: year,
			MM: ('0' + month).slice(-2),
			M: month,
			DD: ('0' + day).slice(-2),
			D: day,
			WW: weekday,
			hh: ('0' + hours).slice(-2),
			h: hours,
			mm: ('0' + minutes).slice(-2),
			m: minutes,
			ss: ('0' + secounds).slice(-2),
			s: secounds,
			AP: ampm
		};

		let replaceStr = '(' + Object.keys(replaceStrArray).join('|') + ')';
		let regex = new RegExp(replaceStr, 'g');

		let ret = format.replace(regex, function(str) {
			return replaceStrArray[str];
		});

		return ret;
	};
};
