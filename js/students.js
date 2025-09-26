const studentsUrl = "https://kivodle-resource.taktstock.blue/students.json";
const latestUrl = "https://kivodle-resource.taktstock.blue/latest.json";

let students;

async function loadStudentsAsync() {
    const latestLocal = getLocalStorage(keyDataLatest);

    try {
        const latestResponse = await fetch(latestUrl);
        if (!latestResponse.ok) {
            throw new Error(`HTTPエラー: ${latestResponse.status}`);
        }
        const latestJson = await latestResponse.json();
        const latest = latestJson.latest;
        if (latestLocal != null && latestLocal >=latest) {
            students = getLocalStorage(keyDataStudents);
        } else {
            const studentsResponse = await fetch(studentsUrl);
            if (!studentsResponse.ok) {
                throw new Error(`HTTPエラー: ${studentsResponse.status}`);
            }
            const studentsJson = await studentsResponse.json();
            students = [];
            studentsJson.forEach(oneStudentRaw => {
                let oneStudent = {};
                let dataDict = {};
                let battleClass = 0b00000;
                dataDict['weapon'] = weapons.findIndex(weapon => weapon === oneStudentRaw.weapon);
                dataDict['school'] = schools.findIndex(school => school === oneStudentRaw.school);
                dataDict['attackType'] = attackTypes.findIndex(attackType => attackType === oneStudentRaw.attackType);
                dataDict['implementationDate'] = oneStudentRaw.implDate;
                oneStudentRaw.battleClass.forEach(oneBattleClass => {
                    battleClass += Number(Object.keys(classes).find(k => classes[k] === oneBattleClass));
                })
                dataDict['class'] = battleClass;
                oneStudent['studentName'] = oneStudentRaw.name;
                oneStudent['data'] = dataDict;
                students.push(oneStudent);
            });
            setLocalStorage(keyDataLatest, latest);
            setLocalStorage(keyDataStudents, students);
        }
    } catch (err) {
        console.error("取得に失敗しました:", err);
    }
}