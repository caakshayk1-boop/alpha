// The news pipeline is plain JavaScript shared by the Worker, the scheduled job and the browser (apps/tripwire/news). Its shapes are documented in the files and pinned by tests/news*.test.ts; to the type checker it is untyped.
declare module "../news/*.js";
declare module "../../news/*.js";
