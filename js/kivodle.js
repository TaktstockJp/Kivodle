const maxTries = 5;
const weapons = ['SG', 'SMG', 'AR', 'GL', 'HG', 'RL', 'SR', 'RG', 'MG', 'MT', 'FT']
const classes = ['タンク', 'アタッカー', 'ヒーラー', 'サポーター', 'T.S']
const schools = ['百鬼夜行', 'レッドウィンター', 'トリニティ', 'ゲヘナ', 'アビドス', 'ミレニアム', 'アリウス', '山海経', 'ヴァルキューレ', 'SRT', 'その他']
const attackTypes = ['爆発', '貫通', '神秘', '振動']
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

let target;
let tries;
let corrects = 0;
let endlessModeFlg = false;
let implementedStudents;
let guesses = [];
const judges = [];
const now = new Date();

// ページロード時に1回だけ実行する
function pageLoad() {
    // 実装されて1日経っていない生徒を除外する処理
    const yesterdayStr = `${String(now.getUTCFullYear())}/${String(now.getUTCMonth() + 1)}/${String(now.getUTCDate() - 1)}`;
    implementedStudents = students.filter(student => {
        return guessDate(student.data.implementationDate, yesterdayStr) !== after;
    });

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
    setTriesAreaInGame();
    $('#guessArea').removeClass('fold');
    $('#infoArea').removeClass(same).removeClass(wrong);
    $('#checkTableBody').empty();
    $('#infoButtonArea').remove();

    // モード別処理
    if (endlessModeFlg) {
        setupEndlessMode(nextFlg);
    } else {
        setupDailyMode();
    }

    // ロード後に解答回数を使い切っていない場合ボタンを有効化
    if (tries < maxTries) { $("#buttonGuess").removeAttr('disabled'); }
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

// 解答を設定する
function setTarget(seed) {
    const mt = new MersenneTwister();
    mt.setSeed(seed);
    target = implementedStudents[mt.nextInt(0, implementedStudents.length)];
}

// デイリーモードへの切り替え
function switchDailyMode() {
    if (!endlessModeFlg) {
        // 既にデイリーモードの場合は何もしない
        return;
    }

    endlessModeFlg = false;
    setup();
}

// エンドレスモードへの切り替え
function switchEndlessMode() {
    if (endlessModeFlg) {
        // 既にエンドレスモードの場合は何もしない
        return;
    }

    endlessModeFlg = true;
    setup();
}

// 解答ボタンを押した時の処理
function answerProcess(guessedName, loadFlg = false) {
    // ボタンを無効化
    $("#buttonGuess").attr('disabled', '');

    // 引数として渡された名前から解答として選ばれた生徒のオブジェクトを取得
    const guessed = implementedStudents.find(s => s.studentName === guessedName);

    // 生徒がリストから見つからなかったら何もしないで戻す
    if (guessed == null) {
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
        setLocalStorage(endlessModeFlg ? keyEndlessGuesses : keyDailyGuesses, guesses)
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
    // 追加する行のHTMLの組み立て
    const $newRow = $('<tr>');
    const cellBase = '<td></td>';

    const $studentCell = $(cellBase).addClass(judgeObj.isHit).html(guessed.studentName);
    $newRow.append($studentCell);
    const $weaponCell = $(cellBase).addClass(judgeObj.isSameWeapon).html(weapons[guessed.data.weapon]);
    $newRow.append($weaponCell);
    const $classCell = $(cellBase).addClass(judgeObj.isSameClass).html(classes[guessed.data.class]);
    $newRow.append($classCell);
    const $schoolCell = $(cellBase).addClass(judgeObj.isSameSchool).html(schools[guessed.data.school]);
    $newRow.append($schoolCell);
    const $attackTypeCell = $(cellBase).addClass(judgeObj.isSameAttackType).html(attackTypes[guessed.data.attackType]);
    $newRow.append($attackTypeCell);
    const $implDateCell = $(cellBase).addClass(judgeObj.isSameImplDate == same ? same : wrong).html(guessed.data.implementationDate + (judgeObj.isSameImplDate == same ? '' : '<br>' + judgeObj.isSameImplDate));
    $newRow.append($implDateCell);

    // テーブルの一番上の行に追加
    $('#checkTableBody').prepend($newRow);
}

// ゲーム終了時の処理
function endGame(isHit, loadFlg = false) {
    const result = `${isHit === same ? '正解！' : '不正解…。'}答えは「${target.studentName}」でした。`;

    $('#guessArea').addClass('fold');
    $('#infoArea').addClass(isHit);
    $('#infoArea').append($('<div>').attr('id', 'infoButtonArea'));
    $('#triesArea').html($('<div>').html(result));

    if (!endlessModeFlg || (endlessModeFlg && isHit === wrong)) {
        // デイリーモードでゲーム終了した時とエンドレスモードで正解できなかった時の処理
        const shareStr = endlessModeFlg ? createShareStrForEndless() : createShareStrForDaily(isHit);
        const encodedShareStr = encodeURIComponent(shareStr);

        $('#infoButtonArea').append($('<div>').attr('id', 'shareButtonArea'));
        $('#shareButtonArea').append($('<button>').attr('id', 'copyButton').html('コピー'));
        $('#shareButtonArea').append($('<button>').attr('id', 'xButton').html('Xでシェア'));
        $('#shareButtonArea').append($('<button>').attr('id', 'misskeyButton').html('Misskeyでシェア'));

        if (endlessModeFlg) {
            $('#infoButtonArea').append($('<div>').attr('id', 'retryButtonArea').css('margin-top', '5px'));
            $('#retryButtonArea').append($('<button>').attr('id', 'retryButton').html('最初から'));
            $('#retryButton').on('click', function () { setup() });

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
    } else {
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