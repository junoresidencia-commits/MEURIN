/** Tipos isolados do módulo Hemodiálise. Não alteram cadastro, agenda nem prontuário. */

export type HdRole = "MEDICO" | "ENFERMAGEM" | "LABORATORIO" | "ADMIN";
export type HdMemberStatus = "active" | "inactive" | "invited";
export type HdShift = "MANHA" | "TARDE" | "NOITE";
export type HdWeekdayGroup = "SEG_QUA_SEX" | "TER_QUI_SAB";
export type HdMonthStatus = "open" | "closed";
export type HdAlertLevel = "OK" | "REVISAR" | "CRITICO";
export type HdReviewDecision = "manter" | "alterar" | "aguardar";
export type HdLabSource = "manual" | "ocr" | "csv" | "xlsx" | "pdf" | "image";
export type HdLabStatus = "pending" | "confirmed" | "rejected";
export type HdRuleSource = "KDIGO" | "SBN" | "INTERNO";

export const HD_PERM_KEYS = [
  "view_patients",
  "view_exams",
  "upload_exams",
  "confirm_ocr",
  "view_map",
  "edit_access",
  "edit_machine",
  "edit_shift",
  "edit_time",
  "edit_capillary",
  "edit_heparin",
  "edit_prescription",
  "review",
  "close_month",
  "view_history",
  "view_audit",
  "manage_team",
  "manage_config",
  "edit_protocols",
] as const;

export type HdPermKey = (typeof HD_PERM_KEYS)[number];
export type HdPermMap = Partial<Record<HdPermKey, boolean>>;

export const HD_EXAM_CODES = [
  "hb",
  "ht",
  "ferritin",
  "tsat",
  "serum_iron",
  "ca",
  "p",
  "pth",
  "k",
  "albumin",
  "hco3",
  "urea_pre",
  "urea_post",
  "creat",
  "na",
] as const;

export type HdExamCode = (typeof HD_EXAM_CODES)[number];

export const HD_MAP_FIELDS = [
  "machine",
  "ward",
  "shift",
  "weekdayGroup",
  "access",
  "heparin",
  "time",
  "capillary",
  "epo",
  "iron",
  "sevelamer",
  "calcitriol",
  "cinacalcet",
  "paricalcitol",
  "notes",
] as const;

export type HdMapField = (typeof HD_MAP_FIELDS)[number];

export type HdUnit = {
  id: string;
  ownerDoctorId: string;
  name: string;
  city: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HdMember = {
  id: string;
  unitId: string;
  doctorId: string | null;
  email: string;
  name: string;
  role: HdRole;
  functionLabel: string;
  status: HdMemberStatus;
  permissions: HdPermMap;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HdPatient = {
  id: string;
  unitId: string;
  /** Id do paciente já existente no Meu Rim, se houver. Não duplica cadastro. */
  patientId: string | null;
  name: string;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type HdMachine = {
  id: string;
  unitId: string;
  number: string;
  ward: string;
  active: boolean;
};

export type HdMonth = {
  id: string;
  unitId: string;
  year: number;
  month: number;
  status: HdMonthStatus;
  closedAt: string | null;
  closedBy: string | null;
  closedByName: string | null;
  createdAt: string;
};

export type HdMapRow = {
  id: string;
  unitId: string;
  monthId: string;
  patientId: string;
  shift: HdShift;
  weekdayGroup: HdWeekdayGroup;
  ward: string;
  machine: string;
  access: string;
  heparin: string;
  time: string;
  capillary: string;
  epo: string;
  iron: string;
  sevelamer: string;
  calcitriol: string;
  cinacalcet: string;
  paricalcitol: string;
  notes: string;
  updatedAt: string;
};

export type HdLabResult = {
  id: string;
  unitId: string;
  monthId: string;
  patientId: string;
  examCode: HdExamCode;
  value: number | null;
  rawValue: string;
  unit: string;
  collectedAt: string | null;
  confidence: number;
  source: HdLabSource;
  status: HdLabStatus;
  fileId: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
};

export type HdLabFile = {
  id: string;
  unitId: string;
  monthId: string | null;
  name: string;
  mime: string;
  path: string;
  storage: "local" | "supabase";
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
};

export type HdPrescription = {
  id: string;
  unitId: string;
  monthId: string;
  patientId: string;
  epo: string;
  iron: string;
  sevelamer: string;
  calcitriol: string;
  cinacalcet: string;
  paricalcitol: string;
  heparin: string;
  time: string;
  capillary: string;
  access: string;
  status: "draft" | "approved";
  updatedAt: string;
};

export type HdReview = {
  id: string;
  unitId: string;
  monthId: string;
  patientId: string;
  decision: HdReviewDecision;
  situation: string;
  suggestion: string;
  notes: string;
  protocolCodes: string[];
  reviewedBy: string;
  reviewedByName: string;
  reviewedAt: string;
};

export type HdRule = {
  id: string;
  code: string;
  domain: string;
  version: string;
  source: HdRuleSource;
  date: string;
  params: Record<string, number>;
  condition: string;
  classification: HdAlertLevel;
  suggestion: string;
  active: boolean;
};

export type HdAuditLog = {
  id: string;
  unitId: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  before: string | null;
  after: string | null;
  justification: string | null;
  protocol: string | null;
  createdAt: string;
};

export type HdSettings = {
  unitId: string;
  expectedExams: HdExamCode[];
  centerName: string;
  updatedAt: string;
};

export type HdAlert = {
  domain: string;
  level: HdAlertLevel;
  code: string;
  message: string;
  suggestion: string;
  source: HdRuleSource;
};

export type HdActor = {
  doctorId: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
};
