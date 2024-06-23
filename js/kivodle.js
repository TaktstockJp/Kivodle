const maxTries = 5;
const weapons = ['SG', 'SMG', 'AR', 'GL', 'HG', 'RL', 'SR', 'RG', 'MG', 'MT', 'FT']
const classes = ['タンク', 'アタッカー', 'ヒーラー', 'サポーター', 'T.S']
const schools = ['百鬼夜行', 'レッドウィンター', 'トリニティ', 'ゲヘナ', 'アビドス', 'ミレニアム', 'アリウス', '山海経', 'ヴァルキューレ', 'SRT', 'その他']
const attackTypes = ['爆発', '貫通', '神秘', '振動']
const same = 'same';
const wrong = 'wrong';
const before = 'より前';
const after = 'より後';

let target;
let tries;
let corrects;
let endFlg = false;
let endlessModeFlg = false;
let implementedStudents;
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
        $('#selectGuess').append($('<option>').html(element.studentName).val(element.studentName));
    });
    $('#selectGuess').select2({ width: 'resolve' });
}

// ゲームの初期化
function setup(nextFlg = false) {
    // 解答回数の初期化
    tries = 0;

    if(endlessModeFlg && nextFlg) {
        // エンドレスモードで「次の問題へ」を押した時
        corrects++;
    } else {
        // 上記以外
        corrects = 0;
        endFlg = false;
    }

    // 答えの設定
    if (endlessModeFlg) {
        setTarget(Date.now());
    } else {
        setTarget(now.getUTCFullYear() * 10000 + now.getUTCMonth() * 100 + now.getUTCDate());
    }

    setInfoAreaInGame();
    $('#guessArea').removeClass('fold');
    $('#infoArea').removeClass(same).removeClass(wrong);
    $('#checkTableBody').html('');
}

// infoAreaの書き換え
function setInfoAreaInGame() {
    if (endlessModeFlg) {
        $('#infoArea').html($('<span>').css('margin-right', '10px').html(`エンドレスモード連続正解数： ${corrects}`));
    } else {
        $('#infoArea').html($('<span>').css('margin-right', '10px').html('デイリーモード'));
    }
    $('#infoArea').append(`解答回数： ${tries} ／ ${maxTries}`);
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
        alert('現在すでにデイリーモードです。')
        return;
    }

    if ((tries > 0 || corrects > 0) && !endFlg) {
        if (!confirm('デイリーモードに切り替えると、現在進行中のゲームは破棄されます。\nデイリーモードに切り替えますか？')) {
            return;
        }
    }

    endlessModeFlg = false;
    judges.splice(0);
    setup();
}

// エンドレスモードへの切り替え
function switchEndlessMode() {
    if (endlessModeFlg) {
        // 既にエンドレスモードの場合は何もしない
        alert('現在すでにエンドレスモードです。')
        return;
    }

    if ((tries > 0) && !endFlg) {
        if (!confirm('エンドレスモードに切り替えると、現在進行中のゲームは破棄されます。\nエンドレスモードに切り替えますか？')) {
            return;
        }
    }

    endlessModeFlg = true;
    judges.splice(0);
    setup();
}

// 解答ボタンを押した時の処理
function answerProcess(guessedName) {
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

    if (judgeObj.isHit === same || tries === maxTries) {
        // 正解または回数を使い切った時の処理
        endGame(judgeObj.isHit);
    } else {
        setInfoAreaInGame();
    }
}

// 各要素ごとの正誤判定
function guess(guessed) {
    const judgeObj = {
        isHit: target === guessed ? same : wrong,
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
function endGame(isHit) {
    const result = `${isHit === same ? '正解！' : '不正解…。'}答えは「${target.studentName}」でした。`;

    $('#guessArea').addClass('fold');
    $('#infoArea').addClass(isHit).html($('<div>').html(result));
    $('#infoArea').append($('<div>').attr('id', 'infoButtonArea'));

    if (!endlessModeFlg || (endlessModeFlg && isHit === wrong)) {
        // デイリーモードでゲーム終了した時とエンドレスモードで正解できなかった時の処理
        const shareStr = endlessModeFlg ? createShareStrForEndless() : createShareStrForDaily(isHit);
        const encodedShareStr = encodeURIComponent(shareStr);

        endFlg = true;

        $('#infoButtonArea').append($('<div>').attr('id', 'shareButtonArea'));
        $('#shareButtonArea').append($('<button>').attr('id', 'copyButton').html('コピー'));
        $('#shareButtonArea').append($('<button>').attr('id', 'xButton').html('Xでシェア'));
        $('#shareButtonArea').append($('<button>').attr('id', 'misskeyButton').html('Misskeyでシェア'));

        if (endlessModeFlg) {
            $('#infoButtonArea').append($('<div>').attr('id', 'retryButtonArea').css('margin-top', '5px'));
            $('#retryButtonArea').append($('<button>').attr('id', 'retryButton').html('最初から'));
            $('#retryButton').on('click', function () { setup() });
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
        $('#infoButtonArea').append($('<button>').attr('id', 'nextButton').html('次の問題へ'));
        $('#nextButton').on('click', function () { setup(true) });
        judges.splice(0);
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
    return `#Kivolde のエンドレスモードで${corrects}問連続で正解しました！\n\n`;
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