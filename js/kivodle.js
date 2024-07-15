const maxTries = 5;
const speedrunMaxStreak = 10;
const weapons = ['SG', 'SMG', 'AR', 'GL', 'HG', 'RL', 'SR', 'RG', 'MG', 'MT', 'FT']
const classes = ['タンク', 'アタッカー', 'ヒーラー', 'サポーター', 'T.S']
const schools = ['百鬼夜行', 'レッドウィンター', 'トリニティ', 'ゲヘナ', 'アビドス', 'ミレニアム', 'アリウス', '山海経', 'ヴァルキューレ', 'SRT', 'その他']
const attackTypes = ['爆発', '貫通', '神秘', '振動']
const modes = Object.freeze({ daily: 'デイリー', endless: 'エンドレス', speedrun: 'スピードラン' });
const same = 'same';
const wrong = 'wrong';
const before = 'より前';
const after = 'より後';

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
let implementedStudents;
let guesses = [];
let speedrunStart;
let speedrunSum;
let intervalId;
const judges = [];
const now = getToday();

// ページロード時に1回だけ実行する
function pageLoad() {
    // 実装されて1日経っていない生徒を除外する処理
    const yesterdayStr = `${String(now.getUTCFullYear())}/${String(now.getUTCMonth() + 1)}/${String(now.getUTCDate() - 1)}`;
    implementedStudents = students.filter(student => {
        return guessDate(student.data.implementationDate, yesterdayStr) !== after;
    });

    // ページを開いた時はモードをデイリーモードに設定
    currentMode = modes.daily;

    setup();

    // プルダウンリストに値を設定する
    implementedStudents.forEach(function (element) {
        $('#selectGuess').append($('<option>').html(element.studentName).val(element.studentName).attr('data-search-hiragana', convertToHiragana(element.studentName)));
    });

    // 横幅とCustomMatcherの登録
    $('#selectGuess').select2({
        width: 'resolve',
        matcher: function (params, data) {
            const select2SearchStr = $(data.element).data('search-hiragana');
            let modifiedData;
            if ($.trim(params.term) === '') {
                return data;
            }
            if (typeof data.text === 'undefined') {
                return null;
            }
            if (data.text.indexOf(params.term) > -1) {
                modifiedData = $.extend({}, data, true);
                return modifiedData;
            }

            if (select2SearchStr === null || select2SearchStr === void 0) {
                return null;
            }
            if (select2SearchStr.toString().indexOf(params.term) > -1) {
                modifiedData = $.extend({}, data, true);
                return modifiedData;
            }
            return null;
        }
    });

    // サイトを初めて訪れる場合、説明用のモーダルを表示
    if (!getLocalStorage(keyGeneralVisited)) {
        setLocalStorage(keyGeneralVisited, true);
        openModal();
    }
}

// ゲームの初期化
function setup(nextFlg = false) {
    // 解答回数の初期化
    tries = 0;

    // 変数とDOMの初期化
    guesses.splice(0);
    judges.splice(0);
    setupDom();

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
        target = lastTarget;
        guesses = getLocalStorage(keyEndlessGuesses) || [];
        corrects = getLocalStorage(keyEndlessCorrects) || 0;
        answerForLoad();
    }

    setModeInfoAreaForEndless();
}

function answerForLoad() {
    guesses.forEach(function (elm) {
        answerProcess(elm, true);
    });
}

// スピードランモードセットアップ時の処理
function setupSpeedrunMode() {
    corrects = 0;
    setupDom();
    $('#guessArea').addClass('fold');
    $('#modeNameArea').html('スピードランモード');
    $('#triesArea').empty();
    $('#infoArea').append($('<div>').attr('id', 'infoButtonArea'));
    $('#infoButtonArea').append($('<button>').attr('id', 'startButton').html('スタート'));
    $('#startButton').on('click', function () { startSpeedrun(false) });
    setWinStreakAreaForSpeedrun();
}

// スピードランの開始
function startSpeedrun(nextFlg) {
    // 解答回数の初期化
    tries = 0;

    // 正解の設定
    setTarget(Date.now());

    // 変数とDOMの初期化
    guesses.splice(0);
    judges.splice(0);
    setupDom();
    setTriesAreaInGame();

    // タイマーの設定
    if (!nextFlg) { speedrunSum = 0; }
    speedrunStart = Date.now();
    setModeInfoAreaForSpeedrunInGame(speedrunSum);
    intervalId = setInterval(function () { setModeInfoAreaForSpeedrunInGame((speedrunSum + (Date.now() - speedrunStart))) }, 100);
}

// triesAreaの書き換え
function setTriesAreaInGame() {
    $('#triesArea').html(`解答回数： ${tries} ／ ${maxTries}`);
}

function setModeInfoAreaForDaily() {
    $('#modeNameArea').html('デイリーモード');
    $('#modeWinStreakArea').html(`連続正解日数：${getLocalStorage(keyDailyWinStreak) || 0}`)
}

function setModeInfoAreaForEndless() {
    $('#modeNameArea').html(`エンドレスモード<br>現在のスコア：${corrects}`);
    $('#modeWinStreakArea').html(`ハイスコア：${getLocalStorage(keyEndlessHighScore) || 0}`)
}

function setModeInfoAreaForSpeedrunInGame(millisecond) {
    const totalSecond = Math.floor(millisecond / 1000);
    const formattedTime = `${Math.floor(totalSecond / 60).toString().padStart(2, '0')}:${(totalSecond % 60).toString().padStart(2, '0')}`;
    $('#modeNameArea').html(`スピードランモード<br>正解数　${corrects} ／ ${speedrunMaxStreak}<br>経過時間　${formattedTime}`);
}

function setWinStreakAreaForSpeedrun() {
    const highScore = getLocalStorage(keySpeedrunHighScore);
    $('#modeWinStreakArea').html(`ハイスコア：${highScore ? millisecondToEncodedStr(highScore) : '記録なし'}`);
}

// 解答を設定する
function setTarget(seed) {
    const mt = new MersenneTwister();
    mt.setSeed(seed);
    target = implementedStudents[mt.nextInt(0, implementedStudents.length)];
}

// モードの切り替え
function switchMode(targetMode) {
    if (currentMode == targetMode) {
        // 既に変更対象のモードなら何もしない
        return;
    }

    // スピードランモードのモード部分書き換えの解除
    if (intervalId !== void 0) {
        clearInterval(intervalId);
        intervalId = void 0;
    }

    currentMode = targetMode;
    setup();
}

// 解答ボタンを押した時の処理
function answerProcess(guessedName, loadFlg = false) {
    // ボタンを無効化
    $("#buttonGuess").attr('disabled', '');

    // 引数として渡された名前から解答として選ばれた生徒のオブジェクトを取得
    const guessed = implementedStudents.find(s => s.studentName === guessedName);

    // 生徒がリストから見つからなかったか既に解答に使った生徒なら何もしないで戻す
    if (guessed == null || (!loadFlg && guesses.includes(guessedName))) {
        $("#buttonGuess").removeAttr('disabled');
        return;
    }

    // 結果判定
    const judgeObj = guess(guessed);
    judges.push(judgeObj);

    // 結果からDOMに追加
    prependTableRow(guessed, judgeObj);

    // 挑戦回数のインクリメント
    tries++;

    // セーブデータのロード中でない場合、答えた生徒をセーブ
    if (!loadFlg) {
        guesses.push(guessedName);
        switch (currentMode) {
            case modes.daily:
                setLocalStorage(keyDailyGuesses, guesses);
                break;
            case modes.endless:
                setLocalStorage(keyEndlessGuesses, guesses);
                break;
        }
    }

    if (judgeObj.isHit === same || tries === maxTries) {
        // 正解または回数を使い切った時の処理
        endGame(judgeObj.isHit, loadFlg);
    } else {
        // ゲームが途中の場合解答回数表示の更新とボタンの再有効化
        setTriesAreaInGame();
        $("#buttonGuess").removeAttr('disabled');
    }
}

// 各要素ごとの正誤判定
function guess(guessed) {
    const judgeObj = {
        isHit: target.studentName === guessed.studentName ? same : wrong,
        isSameWeapon: target.data.weapon === guessed.data.weapon ? same : wrong,
        isSameClass: target.data.class === guessed.data.class ? same : wrong,
        isSameSchool: target.data.school === guessed.data.school ? same : wrong,
        isSameAttackType: target.data.attackType === guessed.data.attackType ? same : wrong,
        isSameImplDate: guessDate(target.data.implementationDate, guessed.data.implementationDate)
    };

    return judgeObj;
}

// テーブルに行を追加
function prependTableRow(guessed, judgeObj) {
    // セルを作成するヘルパー関数
    function createCell(content, isCorrect, extraClasses) {
        return $('<div>')
            .addClass([isCorrect, 'cell', ...extraClasses])
            .html(content);
    }

    // 追加する行のHTMLの組み立て
    const $newRow = $('<div>').addClass('row');

    $newRow.append(createCell(guessed.studentName, judgeObj.isHit, ['studentNameCol']));
    $newRow.append(createCell(weapons[guessed.data.weapon], judgeObj.isSameWeapon, ['weaponTypeCol']));
    $newRow.append(createCell(classes[guessed.data.class], judgeObj.isSameClass, ['classCol']));
    $newRow.append(createCell(schools[guessed.data.school], judgeObj.isSameSchool, ['schoolCol']));
    $newRow.append(createCell(attackTypes[guessed.data.attackType], judgeObj.isSameAttackType, ['attackTypeCol']));
    const implDateContent = guessed.data.implementationDate + 
                            (judgeObj.isSameImplDate === same ? '' : '<br>' + judgeObj.isSameImplDate);
    $newRow.append(createCell(implDateContent, judgeObj.isSameImplDate === same ? same : wrong, ['implDateCol']));

    // グリッドの一番上の行に追加
    $('#checkGridBody').prepend($newRow);
}

// ゲーム終了時の処理
function endGame(isHit, loadFlg = false) {
    const result = `${isHit === same ? '正解！' : '不正解…。'}答えは「${target.studentName}」でした。`;

    $('#guessArea').addClass('fold');
    $('#infoArea').addClass(isHit);
    $('#infoArea').append($('<div>').attr('id', 'infoButtonArea'));
    $('#triesArea').html($('<div>').html(result));

    if (currentMode == modes.daily || (currentMode == modes.endless && isHit === wrong)) {
        // デイリーモードでゲーム終了した時とエンドレスモードで正解できなかった時の処理
        const shareStr = currentMode == modes.endless ? createShareStrForEndless() : createShareStrForDaily(isHit);
        insertShareButton(shareStr);

        if (currentMode == modes.endless) {
            insertRetryButton();

            // セーブデータ削除
            corrects = 0;
            removeLocalStorage(keyEndlessTarget);
            removeLocalStorage(keyEndlessCorrects);
            removeLocalStorage(keyEndlessGuesses);
        } else if (!loadFlg) {
            // デイリーモードかつセーブデータのロード時以外は連続正解日数の設定
            let winStreak = getLocalStorage(keyDailyWinStreak);
            if (isHit === same) {
                setLocalStorage(keyDailyWinStreak, winStreak == null ? 1 : winStreak + 1);
            } else {
                setLocalStorage(keyDailyWinStreak, 0);
            }
            setModeInfoAreaForDaily();
        }
    } else if (currentMode == modes.endless) {
        // エンドレスモードで正解した時の処理
        if (!loadFlg) {
            setLocalStorage(keyEndlessCorrects, ++corrects);
            if (corrects > getLocalStorage(keyEndlessHighScore)) {
                setLocalStorage(keyEndlessHighScore, corrects);
            }
            setModeInfoAreaForEndless();
        }
        $('#infoButtonArea').append($('<button>').attr('id', 'nextButton').html('次の問題へ'));
        $('#nextButton').on('click', function () { setup(true) });
    } else if (currentMode == modes.speedrun) {
        // スピードランモード時の処理
        speedrunSum += Date.now() - speedrunStart;
        clearInterval(intervalId);
        corrects = corrects + (isHit === same ? 1 : 0);
        setModeInfoAreaForSpeedrunInGame(speedrunSum);
        if (corrects >= speedrunMaxStreak) {
            // 指定された問題数を解き終わった時
            const encodedTime = millisecondToEncodedStr(speedrunSum);
            $('#triesArea').append($('<div>').html(`全${speedrunMaxStreak}問正解するのにかかった時間は ${encodedTime} でした。`));

            // ハイスコアの置き換えと表示
            const highScore = getLocalStorage(keySpeedrunHighScore);
            if (!highScore || speedrunSum < highScore) { setLocalStorage(keySpeedrunHighScore, speedrunSum) }
            setWinStreakAreaForSpeedrun();
            insertShareButton(createShareStrForSpeedrun(encodedTime));
            insertRetryButton();
        } else {
            // それ以外
            $('#infoButtonArea').append($('<button>').attr('id', 'nextButton').html('次の問題へ'));
            $('#nextButton').on('click', function () { startSpeedrun(true) });
        }
    }
}

// SNSでシェアする時の文章を作る（デイリーモード用）
function createShareStrForDaily(isHit) {
    let shareStr = '今日の #Kivodle は' + String(judges.length) + '回解答して';
    shareStr += (isHit === same ? '正解しました！' : '不正解でした……。') + '\n\n';

    let i;
    for (i = judges.length - 1; i >= 0; i--) {
        shareStr += judges[i].isHit === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameWeapon === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameClass === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameSchool === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameAttackType === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameImplDate === same ? '🟩' : '🟥';
        shareStr += '\n';
    }

    return shareStr;
}

// SNSでシェアする時の文章を作る（エンドレスモード用）
function createShareStrForEndless() {
    return `#Kivodle のエンドレスモードで${corrects}問連続で正解しました！\n`;
}

// SNSでシェアする時の文章を作る（スピードランモード用）
function createShareStrForSpeedrun(record) {
    return `#Kivodle のスピードランモードで${speedrunMaxStreak}問正解するのにかかった時間は ${record} でした！\n`;
}

// シェアボタンをDOMに挿入する
function insertShareButton(shareStr) {
    const encodedShareStr = encodeURIComponent(shareStr);
    $('#infoButtonArea').append($('<div>').attr('id', 'shareButtonArea'));
    $('#shareButtonArea').append($('<button>').attr('id', 'copyButton').html('コピー'));
    $('#shareButtonArea').append($('<button>').attr('id', 'xButton').html('Xでシェア'));
    $('#shareButtonArea').append($('<button>').attr('id', 'misskeyButton').html('Misskeyでシェア'));
    $('#shareButtonArea').append($('<button>').attr('id', 'mastodonButton').html('Mastodonでシェア'));

    $('#copyButton').on('click', function () {
        navigator.clipboard.writeText(`${shareStr}\n${location.href}`).then(
            () => {
                $('#copyButton').html('コピーしました');
            });
    });
    $('#xButton').on('click', function () {
        window.open(`https://x.com/intent/tweet?text=${encodedShareStr}%0A&url=${location.href}`);
    });
    $('#misskeyButton').on('click', function () {
        window.open(`https://misskey-hub.net/share/?text=${encodedShareStr}&url=${location.href}&visibility=public&localOnly=0`);
    });
    $('#mastodonButton').on('click', function () {
        window.open(`https://donshare.net/share.html?text=${encodedShareStr}&url=${location.href}`);
    });
}

function insertRetryButton() {
    $('#infoButtonArea').append($('<div>').attr('id', 'retryButtonArea').css('margin-top', '5px'));
    $('#retryButtonArea').append($('<button>').attr('id', 'retryButton').html('最初から'));
    $('#retryButton').on('click', function () { setup() });
}

// 日付の前後判定
function guessDate(targetImplDate, guessImplDate) {
    let targetArr = targetImplDate.split('/');
    let guessArr = guessImplDate.split('/');

    let i;
    for (i = 0; i < targetArr.length; i++) {
        if (Number(targetArr[i]) > Number(guessArr[i])) {
            return after;
        } else if (Number(targetArr[i]) < Number(guessArr[i])) {
            return before;
        }
    }

    return same;
}

function millisecondToEncodedStr(millisecond) {
    const totalSecond = Math.floor(millisecond / 1000);
    return `${Math.floor(totalSecond / 60).toString().padStart(2, '0')}:${(totalSecond % 60).toString().padStart(2, '0')}.${(totalSecond % 1000).toString().padStart(3, '0')}`
}

function openModal() {
    $('#modalOverlay').addClass('open');
    $('#modal').addClass('open');
}

function closeModal() {
    $('#modalOverlay').removeClass('open');
    $('#modal').removeClass('open');
}

function convertToHiragana(src) {
    const replaceDic = {
        '（': '',
        '）': '',
        '正月': 'しょうがつ',
        '水着': 'みずぎ',
        '私服': 'しふく',
        '温泉': 'おんせん',
        '幼女': 'ようじょ',
        '体操服': 'たいそうふく',
        '応援団': 'おうえんだん',
        '御坂美琴': 'みさかみこと',
        '佐天涙子': 'さてんるいこ',
        '食蜂操祈': 'しょくほうみさき',
        '初音': 'はつね',
    };

    let ret = src.replace(/[\u30a1-\u30f6]/g, function (match) {
        var chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });

    for (let key in replaceDic) {
        if (src.includes(key)) {
            ret = ret.replace(key, replaceDic[key]);
        }
    }

    return ret;
}

// 今日の日付を取得する
// ただしUTCで午後19時以降（日本時間午前4時～午前9時までの間）の場合日付を1日進める
function getToday() {
    const today = new Date();
    if (today.getUTCHours() >= 19) {
        today.setUTCDate(today.getUTCDate() + 1);
    }
    return today;
}

function getLocalStorage(key) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
}

function setLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function removeLocalStorage(key) {
    localStorage.removeItem(key);
}