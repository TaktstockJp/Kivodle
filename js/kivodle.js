const maxTries = 5;
const speedrunMaxStreak = 10;
const weapons = Object.freeze(['SG', 'SMG', 'AR', 'GL', 'HG', 'RL', 'SR', 'RG', 'MG', 'MT', 'FT']);
const classes = Object.freeze({ 0b00001: 'タンク', 0b00010: 'アタッカー', 0b00100: 'ヒーラー', 0b01000: 'サポーター', 0b10000: 'T.S' });
const schools = Object.freeze(['百鬼夜行', 'レッドウィンター', 'トリニティ', 'ゲヘナ', 'アビドス', 'ミレニアム', 'アリウス', '山海経', 'ヴァルキューレ', 'SRT', 'その他', 'ハイランダー', 'ワイルドハント']);
const attackTypes = Object.freeze(['爆発', '貫通', '神秘', '振動']);
const modes = Object.freeze({ daily: 'デイリー', endless: 'エンドレス', speedrun: 'スピードラン' });
const same = 'same';
const wrong = 'wrong';
const before = 'より前';
const after = 'より後';
const regulations = Object.freeze([
    { label: '全期間', period: '2099/12/31', key: '' },
    { label: '1周年まで', period: '2022/01/26', key: '.1st' },
    { label: '2周年まで', period: '2023/01/24', key: '.2nd' },
    { label: '3周年まで', period: '2024/01/31', key: '.3rd' },
    { label: '4周年まで', period: '2025/01/27', key: '.4th' },
]);

const keyGeneralVisited = 'Kivodle.General.Visited';
const keyDailyLastPlayed = 'Kivodle.Daily.LastPlayed';
const keyDailyGuesses = 'Kivodle.Daily.Guesses';
const keyDailyWinStreak = 'Kivodle.Daily.WinStreak';
const keyEndlessTarget = 'Kivodle.Endless.Target';
const keyEndlessGuesses = 'Kivodle.Endless.Guesses';
const keyEndlessCorrects = 'Kivodle.Endless.Corrects';
const keyEndlessHighScore = 'Kivodle.Endless.HighScore';
const keySpeedrunHighScore = 'Kivodle.Speedrun.HighScore';

let target;
let tries;
let corrects = 0;
let currentMode;
let currentRegulation;
let implementedStudents;
let regulatedStudents;
let guesses = [];
let speedrunStart;
let speedrunSum;
let intervalId;
let pulldown;
const judges = [];
const now = getToday();

// ページロード時に1回だけ実行する
function pageLoad() {
    // 実装されて1日経っていない生徒を除外する処理
    const yesterdayStr = `${String(now.getUTCFullYear())}/${String(now.getUTCMonth() + 1)}/${String(now.getUTCDate() - 1)}`;
    implementedStudents = students.filter(student => {
        return guessDate(student.data.implementationDate, yesterdayStr) !== after;
    });

    // Selectの初期化
    pulldown = new TomSelect('#selectGuess', {
        create: false,
        maxItems: 1,
        maxOptions: implementedStudents.length,
        valueField: 'value',
        labelField: 'text',
        searchField: ['text', 'uniqueName', 'editionName'],
        sortField: null,
        score: function (search) {
            return function (item) {
                // Prioritize exact Kanji matches
                if (item.text === search) return 4;
                if (item.uniqueName === search) return 3.5;
                if (item.editionName === search) return 3;

                // Next, prioritize partial Kanji matches (addresses the core bug)
                if (item.text.includes(search)) return 2.5; // e.g., '食蜂' matches '食蜂操祈'
                if (item.uniqueName.includes(search)) return 2; // e.g., '食蜂' matches unique part of '食蜂操祈'
                if (item.editionName.includes(search)) return 1.8; // e.g., '水着' matches edition part of '食蜂操祈(水着)'

                // Fallback to existing Hiragana/Katakana search logic (converted to Hiragana)
                // These scores are set lower than Kanji matches
                const uniqueNameHiragana = convertToHiragana(item.uniqueName);
                const editionNameHiragana = convertToHiragana(item.editionName);
                const term = convertToHiragana(search);

                if (uniqueNameHiragana === term) return 1.5;
                if (editionNameHiragana === term) return 1.3;
                if (uniqueNameHiragana.includes(term)) return 1;
                if (editionNameHiragana.includes(term)) return 0.8;

                return 0; // No match found
            }
        }
    });

    pulldown.on('dropdown_open', () => {
        pulldown.clear();
    });

    // ページを開いた時はモードをデイリーモードに設定
    currentMode = modes.daily;

    setup();

    // サイトを初めて訪れる場合、説明用のモーダルを表示
    if (!getLocalStorage(keyGeneralVisited)) {
        setLocalStorage(keyGeneralVisited, true);
        openModal();
    }
}

// プルダウンリストに値を設定する
function setStudentusToSelect(studentsList) {
    // 値のリストを作成
    let options = [];
    studentsList.forEach(function (element) {
        options.push({
            value: element.studentName,
            text: element.studentName,
            uniqueName: extractUniqueName(element.studentName),
            editionName: extractEditionName(element.studentName),
        });
    });

    // 値を（再）設定
    pulldown.clear();
    pulldown.clearOptions();
    pulldown.addOptions(options);
    pulldown.refreshOptions(false);
}

// ゲームの初期化
function setup(nextFlg = false) {
    // 解答回数の初期化
    tries = 0;

    // 変数とDOMの初期化
    guesses.splice(0);
    judges.splice(0);
    setupDom();

    // プルダウンリストへの値の登録（スピードラン以外）
    if (currentMode !== modes.speedrun && !nextFlg) {
        setStudentusToSelect(implementedStudents);
    }

    // モード別処理
    switch (currentMode) {
        case modes.daily:
            setupDailyMode();
            break;
        case modes.endless:
            setupEndlessMode(nextFlg);
            break;
        case modes.speedrun:
            setupSpeedrunMode();
            break;
        default:
            currentMode = modes.daily;
            setupDailyMode();
            break;
    }

    // ロード後に解答回数を使い切っていない場合ボタンを有効化
    if (tries < maxTries) { $("#buttonGuess").removeAttr('disabled'); }
}

function setupDom() {
    setTriesAreaInGame();
    $('#guessArea').removeClass('fold');
    $('#infoArea').removeClass(same).removeClass(wrong);
    $('#checkGridBody').empty();
    $('#infoButtonArea').remove();
    $("#buttonGuess").removeAttr('disabled');
}

// デイリーモードセットアップ時の処理
function setupDailyMode() {
    // デイリーモードの正解の設定
    setTarget(now.getUTCFullYear() * 10000 + now.getUTCMonth() * 100 + now.getUTCDate());

    // 今日分のセーブデータの有無によって分岐
    const todayStr = `${now.getUTCFullYear()}/${now.getUTCMonth() + 1}/${now.getUTCDate()}`
    const lastPlayed = getLocalStorage(keyDailyLastPlayed);
    if (lastPlayed !== null && guessDate(todayStr, lastPlayed) === same) {
        // セーブデータがある場合それに沿ってゲームを再現する
        guesses = getLocalStorage(keyDailyGuesses) || [];
        answerForLoad();
    } else {
        // セーブデータがないか、当日のもの以外
        removeLocalStorage(keyDailyGuesses);
        setLocalStorage(keyDailyLastPlayed, todayStr);
    }

    setModeInfoAreaForDaily();
}

// エンドレスモードセットアップ時の処理
function setupEndlessMode(nextFlg) {
    // エンドレスモードの正解の設定
    const lastTarget = getLocalStorage(keyEndlessTarget);
    if (nextFlg || !lastTarget) {
        // エンドレスモード初回、もしくは前の問題で正解して「次へ」を選んでいた場合
        setTarget(Date.now());
        setLocalStorage(keyEndlessTarget, target);
        removeLocalStorage(keyEndlessGuesses);
    } else {
        // エンドレスモードのセーブデータのロード時
        target = implementedStudents.find((elm) => elm.studentName === lastTarget.studentName);
        guesses = getLocalStorage(keyEndlessGuesses) || [];
        corrects = getLocalStorage(keyEndlessCorrects) || 0;
        answerForLoad();
    }

    setModeInfoAreaForEndless();
}