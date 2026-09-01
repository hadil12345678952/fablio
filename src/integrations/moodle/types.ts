// Types des réponses des web services Moodle (protocole REST standard).

export interface InfoSiteMoodle {
  sitename?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  userid?: number;
  siteurl?: string;
  release?: string;
  version?: string;
  functions?: { name: string; version: string }[];
}

export interface UtilisateurMoodle {
  id: number;
  username?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
}

export interface CoursMoodle {
  id: number;
  fullname?: string;
  shortname?: string;
}

export interface QuizMoodle {
  id: number;
  course?: number;
  coursemodule?: number;
  name?: string;
  intro?: string;
  sumgrades?: number;
  grade?: number;
  timelimit?: number;
}

export interface TentativeMoodle {
  id: number;
  quiz?: number;
  userid: number;
  attempt?: number;
  uniqueid?: number;
  state?: string;
  timestart?: number;
  timefinish?: number;
  timemodified?: number;
  sumgrades?: number;
}

export interface RechercheUtilisateurs {
  users?: UtilisateurMoodle[];
}

// Identité plateforme passée à la couche Moodle (jamais de secrets ici).
export interface IdentitePlateforme {
  type: "enseignant" | "eleve";
  id: string;
  prenom: string;
  nom: string;
  email: string;
}
