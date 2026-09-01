// ---------------------------------------------------------------------------
// HARNAIS DE TEST — mini-émulateur des web services Moodle.
//
// Il simule l'endpoint  POST /webservice/rest/server.php  avec les fonctions
// utilisées par la couche d'intégration Fablio (création de comptes, cours,
// inscriptions, quiz, tentatives). Il permet de tester l'intégration SANS
// serveur Moodle réel.
//
// Usage de test :
//   node scripts/mock-moodle.mjs          → http://127.0.0.1:8901
//   MOODLE_URL="http://127.0.0.1:8901" MOODLE_TOKEN="demo-token" …
//   curl http://127.0.0.1:8901/__etat   → compteurs internes (assertions)
// ---------------------------------------------------------------------------

import http from "node:http";

const PORT = Number(process.env.PORT_MOCK || 8901);

const etat = {
  users: new Map(), // id → user
  userParEmail: new Map(),
  cours: new Map(), // id → cours
  coursParShortname: new Map(),
  inscriptions: [],
  quizzes: new Map(), // quizid → quiz  (stockage local_fablio)
  prochainUserId: 100,
  prochainCoursId: 10,
  prochainQuizId: 42,
  prochainQuestionId: 500,
  results: {},
  appels: {},
};

function compter(f) {
  etat.appels[f] = (etat.appels[f] ?? 0) + 1;
}

function json(res, donnees, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(donnees));
}

const serveur = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__etat") {
    return json(res, {
      utilisateurs: etat.users.size,
      cours: etat.cours.size,
      inscriptions: etat.inscriptions.length,
      quizs: etat.quizzes.size,
      questions: [...etat.quizzes.values()].reduce((n, q) => n + (q.questions?.length ?? 0), 0),
      appels: etat.appels,
    });
  }

  if (req.method !== "POST" || !req.url.includes("/webservice/rest/server.php")) {
    return json(res, { erreur: "not found" }, 404);
  }

  let corps = "";
  req.on("data", (morceau) => (corps += morceau));
  req.on("end", () => {
    const p = new URLSearchParams(corps);
    const fonction = p.get("wsfunction") ?? "";
    compter(fonction);

    const tableau = (prefixe) => {
      // Reconstruit les tableaux Moodle-style : users[0][username]=x
      const sortie = new Map();
      for (const [cle, valeur] of p.entries()) {
        const m = cle.match(new RegExp(`^${prefixe}\\[(\\d+)\\]\\[([\\w]+)\\]$`));
        if (m) {
          const i = Number(m[1]);
          const obj = sortie.get(i) ?? {};
          obj[m[2]] = valeur;
          sortie.set(i, obj);
        }
      }
      return [...sortie.values()];
    };

    switch (fonction) {
      case "core_webservice_get_site_info":
        return json(res, {
          sitename: "Moodle de démonstration (harnais)",
          username: "svc-fablio",
          firstname: "Service",
          lastname: "Fablio",
          userid: 2,
          siteurl: `http://127.0.0.1:${PORT}`,
          release: "4.5.0 (Build: 20251010)",
          version: "2024100700.00",
          functions: [
            { name: "core_user_create_users", version: "20241007" },
            { name: "core_course_create_courses", version: "20241007" },
            { name: "mod_quiz_get_quizzes_by_courses", version: "20241007" },
            { name: "mod_quiz_get_user_attempts", version: "20241007" },
          ],
        });

      case "core_user_get_users": {
        const crit = tableau("criteria")[0] ?? {};
        const trouve = etat.userParEmail.get(crit.value) ?? null;
        return json(res, { users: trouve ? [trouve] : [] });
      }

      case "core_user_create_users": {
        const nouveaux = tableau("users").map((u) => {
          const user = {
            id: etat.prochainUserId++,
            username: u.username,
            email: u.email,
            firstname: u.firstname,
            lastname: u.lastname,
            role: u.username?.startsWith("fablioens") ? "enseignant" : "eleve",
          };
          etat.users.set(user.id, user);
          etat.userParEmail.set(user.email, user);
          return { id: user.id, username: user.username };
        });
        return json(res, nouveaux);
      }

      case "core_course_get_courses_by_field": {
        const cours = [...etat.cours.values()].filter(
          (c) => c[p.get("field") ?? "shortname"] === p.get("value")
        );
        return json(res, cours);
      }

      case "core_course_create_courses": {
        const cree = tableau("courses").map((c) => {
          const cours = {
            id: etat.prochainCoursId++,
            shortname: c.shortname,
            fullname: c.fullname,
          };
          etat.cours.set(cours.id, cours);
          etat.coursParShortname.set(cours.shortname, cours);
          return { id: cours.id, shortname: cours.shortname };
        });
        return json(res, cree);
      }

      case "enrol_manual_enrol_users": {
        for (const i of tableau("enrolments")) etat.inscriptions.push(i);
        return json(res, null);
      }

      case "mod_quiz_get_quizzes_by_courses": {
        const course = Number(p.get("courseids[0]") ?? 0);
        return json(res, {
          quizzes: [
            {
              id: 42,
              course,
              coursemodule: 8432,
              name: "Quiz Moodle — La Cigale et la Fourmi",
              intro: "<p>Quiz de démonstration créé dans Moodle.</p>",
              sumgrades: 20,
              grade: 20,
              timelimit: 0,
            },
          ],
        });
      }

      case "mod_quiz_get_user_attempts": {
        const eleves = [...etat.users.values()].filter((u) => u.role === "eleve").slice(0, 2);
        const maintenant = Math.floor(Date.now() / 1000);
        const notes = [18, 14.5];
        return json(res, {
          attempts: eleves.map((u, i) => ({
            id: 901 + i,
            quiz: Number(p.get("quizid") ?? 42),
            userid: u.id,
            attempt: 1,
            state: "finished",
            timestart: maintenant - 7200 + i * 120,
            timefinish: maintenant - 7000 + i * 120,
            sumgrades: notes[i] ?? 15,
          })),
        });
      }

      case "core_user_get_users_by_field": {
        const ids = Object.entries(Object.fromEntries(p))
          .filter(([k]) => /^values\[\d+\]$/.test(k))
          .map(([, v]) => Number(v));
        return json(
          res,
          ids
            .map((id) => etat.users.get(id))
            .filter(Boolean)
            .map((u) => ({
              id: u.id,
              username: u.username,
              firstname: u.firstname,
              lastname: u.lastname,
            }))
        );
      }

      // ------------------------------------------------------- local_fablio
      case "local_fablio_get_site_info":
        return json(res, {
          sitename: "Moodle de démonstration (harnais)",
          username: "svc-fablio",
          release: "4.5.0 (Build: 20251010)",
          version: "2024100700",
        });

      case "local_fablio_create_quiz": {
        const c = {
          quizid: etat.prochainQuizId++,
          courseid: Number(p.get("courseid")),
          name: p.get("name") ?? "Quiz",
          grade: Number(p.get("maxgrade") ?? 10),
          sumgrades: 0,
          visible: 1,
        };
        etat.quizzes.set(c.quizid, c);
        return json(res, { quizid: c.quizid, coursemoduleid: 8000 + c.quizid });
      }

      case "local_fablio_list_quizzes": {
        const course = Number(p.get("courseid"));
        return json(
          res,
          [...etat.quizzes.values()]
            .filter((q) => q.courseid === course)
            .map((q) => ({ id: q.quizid, name: q.name, coursemoduleid: 8000 + q.quizid }))
        );
      }

      case "local_fablio_create_question": {
        const quizid = Number(p.get("quizid"));
        const quiz = etat.quizzes.get(quizid);
        if (!quiz) return json(res, { exception: "invalid_parameter", message: "quiz inconnu" }, 400);
        const qid = etat.prochainQuestionId++;
        const q = {
          id: qid,
          quizid,
          qtype: p.get("qtype"),
          name: p.get("name"),
          questiontext: p.get("questiontext"),
          maxmark: Number(p.get("maxmark") ?? 1),
          data: JSON.parse(p.get("data") ?? "{}"),
        };
        quiz.questions = quiz.questions ?? [];
        quiz.questions.push(q);
        quiz.sumgrades = Math.round((quiz.sumgrades + q.maxmark) * 100) / 100;
        return json(res, { questionid: qid });
      }

      case "local_fablio_get_quiz_detail": {
        const quiz = etat.quizzes.get(Number(p.get("quizid")));
        if (!quiz) return json(res, { exception: "invalid_parameter", message: "quiz inconnu" }, 400);
        return json(res, {
          quizid: quiz.quizid,
          name: quiz.name,
          maxgrade: quiz.grade,
          sumgrades: quiz.sumgrades,
          questioncount: (quiz.questions ?? []).length,
          questions: (quiz.questions ?? []).map((q) => ({
            id: q.id, slot: (quiz.questions ?? []).indexOf(q) + 1,
            qtype: q.qtype, name: q.name, maxmark: q.maxmark,
          })),
        });
      }

      case "local_fablio_set_quiz_visible":
        return json(res, { result: true });

      case "local_fablio_submit_attempt": {
        const quizid = Number(p.get("quizid"));
        const userid = Number(p.get("userid"));
        const quiz = etat.quizzes.get(quizid);
        if (!quiz) return json(res, { exception: "invalid_parameter", message: "quiz inconnu" }, 400);
        const answers = JSON.parse(p.get("answers") ?? "{}");
        
        const questions = quiz.questions ?? [];
        let correct = 0;
        let earned = 0;
        let sum = 0;
        questions.forEach((q, slotIdx) => {
          const slotKey = String(slotIdx + 1);
          const ans = answers[slotKey] ?? {};
          sum += q.maxmark;
          if (grass(q, ans)) {
            correct++;
            earned += q.maxmark;
          }
        });
        const percent = sum > 0 ? (earned / sum) * 100 : 0;
        const grade = Math.round((percent / 100) * quiz.grade * 100) / 100;
        const key = `${quizid}:${userid}`;
        etat.results = etat.results ?? {};
        etat.results[key] = (etat.results[key] ?? 0) + 1;
        const attempt = etat.results[key];
        return json(res, {
          attemptid: 9000 + attempt,
          grade,
          maxgrade: quiz.grade,
          percent: Math.round(percent * 10) / 10,
          correctcount: correct,
          questioncount: questions.length,
          feedback: percent >= 90 ? "Excellent ! Un très bon score." : percent >= 70 ? "Bravo, très bien !" : percent >= 50 ? "Pas mal, continue !" : "Relis la fable et réessaie !",
        });
      }

      case "local_fablio_get_attempts": {
        const quizid = Number(p.get("quizid"));
        const quiz = etat.quizzes.get(quizid);
        const out = [];
        for (const [key, attempt] of Object.entries(etat.results ?? {})) {
          const [qid, uid] = key.split(":").map(Number);
          if (qid !== quizid) continue;
          const u = etat.users.get(uid);
          out.push({
            attemptid: 9000 + attempt,
            userid: uid,
            username: u?.username ?? "",
            firstname: u?.firstname ?? "",
            lastname: u?.lastname ?? "",
            attempt,
            grade: quiz ? Math.round((0.8 * quiz.grade) * 100) / 100 : 0,
            maxgrade: quiz?.grade ?? 10,
            percent: 80,
            timecreated: Math.floor(Date.now() / 1000),
          });
        }
        return json(res, out);
      }

      case "local_fablio_get_progress": {
        const quizid = Number(p.get("quizid"));
        const userid = Number(p.get("userid"));
        const key = `${quizid}:${userid}`;
        const attempts = etat.results?.[key] ?? 0;
        return json(res, {
          quizid, userid, attempts, attemptscompleted: attempts,
          percent: attempts > 0 ? 82 : 0, grade: attempts > 0 ? 8.2 : 0,
          maxgrade: etat.quizzes.get(quizid)?.grade ?? 10, completed: attempts > 0,
        });
      }

      default:
        return json(res, {
          exception: "webservice_access_exception",
          errorcode: "accessexception",
          message: `Fonction inconnue du harnais : ${fonction}`,
        });
    }
  });
});

// Mini-correcteur du harnais (fidèle à helper.php du plugin).
function grass(q, ans) {
  if (q.qtype === "multichoice") {
    const corrects = new Set((q.data?.corrects ?? []).map(Number));
    const sel = (ans.selected ?? []).map(Number);
    const hits = sel.filter((s) => corrects.has(s)).length;
    return hits > 0 && hits === corrects.size && hits === sel.length;
  }
  if (q.qtype === "truefalse") {
    return (ans.value ?? null) === (q.data?.answer ?? true);
  }
  if (q.qtype === "shortanswer") {
    const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return norm(ans.text) === norm(q.data?.answer ?? "");
  }
  return false;
}

serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-moodle] en écoute sur http://127.0.0.1:${PORT}`);
});
