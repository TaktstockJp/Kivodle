const same = 'same';
const near = 'near';
const wrong = 'wrong';

let dictionary = [];
let target;

// ページロード時の処理
function pageLoad() {
    // 生徒辞書を作る
    // NPCは含むが衣装違いやコラボ生徒などは含まない
    dictionary = students.filter(
        student => { return /^[\u30A0-\u30FF]+$/.test(student.studentName) }
    ).map(student => student.studentName).concat(npcStudents).sort();

    setTarget(Date.now());
}

// 解答を設定する
function setTarget(seed) {
    const mt = new MersenneTwister();
    mt.setSeed(seed);
    target = dictionary[mt.nextInt(0, dictionary.length)];
}

// 解答する
function guess(text) {
    if (!dictionary.includes(text)) {
        return;
    }
    let splitTarget = target.split('');
    let splitGuess = text.split('');
    let splitGuessCopy = JSON.parse(JSON.stringify(splitGuess));
    let hits = Array(4).fill('wrong');
    let sameLetters = splitTarget.length == splitGuess.length;

    // 同じ位置に同じ文字があるか
    for (var i = 0; i < (splitTarget.length < splitGuessCopy.length ? splitTarget.length : splitGuessCopy.length); i++) {
        if (splitTarget[i] == splitGuessCopy[i]) {
            hits[i] = same;
            splitTarget[i] = splitGuessCopy[i] = '済';
        }
    }

    // 違う位置に同じ文字があるか
    for (var i = 0; i < splitGuessCopy.length; i++) {
        if (splitGuessCopy[i] != '済' && splitTarget.includes(splitGuessCopy[i])) {
            hits[i] = near;
        }
    }

    const newRow = $('<div>').addClass('row');
    for (var i = 0; i < hits.length; i++) {
        newRow.append($('<div>').addClass(['cell', hits[i]]).html(i < splitGuess.length ? splitGuess[i] : ''));
    }

    newRow.append($('<div>').addClass(['cell', sameLetters ? same : wrong]).html(checkLength(splitTarget.length, splitGuess.length)));

    $('#checkGridBody').append(newRow);
}

function checkLength(targetLength, guessLength) {
    if (targetLength < guessLength) {
        return '↓';
    } else if (targetLength > guessLength) {
        return '↑';
    }
    return '同じ';
}

$(document).ready(function () { pageLoad(); });