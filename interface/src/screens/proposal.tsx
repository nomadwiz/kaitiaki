// Screen 2, Proposal (`#/proposal/<n>`). Its issue fills it.
import { PageHead } from "../shell.js";

export function Proposal({ id }: { id: string }) {
  return <PageHead title={`Proposal #${id}`} />;
}
