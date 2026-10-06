// The interface's whole ABI (#150, FR41): the write functions the screens
// call, and every custom error of the six contracts and MockNZD, so a refusal
// decodes to the RefusalNotice message for it (interface.md §3). `send` is
// the one path every transaction takes. No `view` or
// `pure` fragment: the interface cannot read storage through an ABI that has
// none. Signatures are copied from the compiled contracts; test/interface.ts
// fails if one drifts or a contract gains an error missing here.
import { Interface, isError } from "ethers";

import { date, nzd } from "./format.js";
import type { Done, Notice } from "./states.js";

export const ABI = new Interface([
  "function castVote(uint256 proposalId, bool inFavour) returns (uint256 weight)",
  // Treasury, and the OpenZeppelin AccessControl it inherits
  "error AccessControlBadConfirmation()",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error AmountExceedsLimit(uint256 proposalId, uint256 amount, uint256 alreadyReleased, uint256 limit)",
  "error DepositorNotConfigured()",
  "error FundMismatch(uint8 expectedFund, uint8 actualFund)",
  "error GovernanceNotConfigured()",
  "error InsufficientBalance(uint8 fund, uint256 amount, uint256 balance)",
  "error InvalidFundSplit(uint256 ratioBps)",
  "error PayeeMismatch(address expectedPayee, address actualPayee)",
  "error PayeeNotRegistered(address payee)",
  "error PayeeRegistryAddressIsZero()",
  "error PaymentTransferFailed(address payee, uint256 amount)",
  "error SettlementAssetAddressIsZero()",
  "error SettlementTransferFailed(uint256 amount)",
  "error TimelockNotConfigured()",
  "error UnauthorizedLevyLedger(address caller)",
  "error UnauthorizedReleaser(address caller)",
  "error UnknownProposal(uint256 proposalId)",
  // Governance; PayeeNotRegistered and UnknownProposal are Treasury's too
  "error AlreadyAttested(uint256 proposalId)",
  "error AlreadyExecuted(uint256 proposalId)",
  "error AlreadyQueued(uint256 proposalId)",
  "error AlreadyVoted(uint256 proposalId, address voter)",
  "error CompanyIdIsEmpty()",
  "error EvidenceHashIsZero()",
  "error FirmIsZero()",
  "error MembershipRegistryIsZero()",
  "error NotAttested(uint256 proposalId)",
  "error NotBoundOwner(address caller)",
  "error NotFirm(address caller)",
  "error NotPassed(uint256 proposalId, uint8 state)",
  "error NotQueued(uint256 proposalId, uint8 state)",
  "error NotReady(uint256 proposalId, uint256 eta)",
  "error NotWorkProposal(uint256 proposalId)",
  "error PayeeRegistryIsZero()",
  "error TimelockIsZero()",
  "error TreasuryIsZero()",
  "error VendorIsZero()",
  "error VendorNameIsEmpty()",
  "error VotingClosed(uint256 proposalId)",
  // MembershipRegistry
  "error AdapterIsZero()",
  "error NotAdapter(address caller)",
  "error UnitAlreadyBound(uint256 unitId, address boundTo)",
  "error WalletIsZero()",
  // LevyLedger; TreasuryIsZero is Governance's too
  "error ChargeAlreadyIssued(uint256 chargeId)",
  "error ChargeAlreadyPaid(uint256 chargeId)",
  "error ChargeNotDue(uint256 chargeId, uint256 dueDate)",
  "error LevyTransferFailed(address payer, uint256 amount)",
  "error ScheduleLengthMismatch(uint256 unitIds, uint256 amounts, uint256 dueDates)",
  "error TreasuryApprovalFailed(uint256 amount)",
  "error UnknownCharge(uint256 chargeId)",
  // PayeeRegistry
  "error ExecutorIsZero()",
  "error PayeeAlreadyRegistered(address payee, uint256 admittedBy)",
  "error PayeeIsZero()",
  "error ProposalIdIsZero()",
  "error UnauthorizedExecutor(address caller)",
  // OpenZeppelin TimelockController
  "error FailedCall()",
  "error TimelockInsufficientDelay(uint256 delay, uint256 minDelay)",
  "error TimelockInvalidOperationLength(uint256 targets, uint256 payloads, uint256 values)",
  "error TimelockUnauthorizedCaller(address caller)",
  "error TimelockUnexecutedPredecessor(bytes32 predecessorId)",
  "error TimelockUnexpectedOperationState(bytes32 operationId, bytes32 expectedStates)",
  // MockNZD, and the OpenZeppelin ERC-20 errors a levy payment reverts with
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InvalidApprover(address approver)",
  "error ERC20InvalidReceiver(address receiver)",
  "error ERC20InvalidSender(address sender)",
  "error ERC20InvalidSpender(address spender)",
  "error MintOutsideTestChain(uint256 chainId)",
]);

// RefusalNotice's messages, by contract error, with interface.md §3's five
// additions. Dates and money come from the error's own arguments.
const MESSAGES: Record<string, (args: bigint[]) => string> = {
  NotBoundOwner: () =>
    "This wallet holds no unit in this building, so it cannot vote.",
  AlreadyVoted: () => "Your units have already voted on this proposal.",
  VotingClosed: () => "Voting on this proposal has closed.",
  NotReady: ([, eta]) => `The 7-day wait ends on ${date(eta)}.`,
  NotAttested: () => "Payment waits for the firm to confirm the work is done.",
  PayeeNotRegistered: () => "This vendor has not been approved by owners.",
  ChargeNotDue: ([, dueDate]) =>
    `This charge cannot be issued before ${date(dueDate)}.`,
  NotFirm: () =>
    "Only the management firm’s wallet can propose or confirm work.",
  AlreadyAttested: () => "The firm has already confirmed this work.",
  EvidenceHashIsZero: () => "Add the evidence hash before confirming.",
  NotPassed: () => "Only a proposal that passed can be queued.",
  AlreadyQueued: () => "This proposal is already queued.",
  NotQueued: () => "This proposal is not queued for payment.",
  AlreadyExecuted: () => "This proposal has already been carried out.",
  UnknownProposal: () => "There is no proposal with that number.",
  ChargeAlreadyIssued: () => "This charge has already been issued.",
  ChargeAlreadyPaid: () => "This charge has already been paid.",
  // The cap is the fourth argument, `limit`, not the amount asked for.
  AmountExceedsLimit: ([, , , limit]) =>
    `This payment would go over the proposal’s cap of ${nzd(limit)}.`,
  VendorNameIsEmpty: () => "Add the vendor's name before proposing.",
  CompanyIdIsEmpty: () =>
    "Add the vendor's company identifier before proposing.",
  NotWorkProposal: () =>
    "Only a work proposal needs the firm to confirm the work.",
  ERC20InsufficientBalance: () =>
    "This wallet does not hold enough NZD to pay this charge.",
  ERC20InsufficientAllowance: () =>
    "The levy ledger was not approved to take this payment. Approve it in your wallet, then pay.",
};

/**
 * Why a transaction did not happen, in plain words. `name` is the contract
 * error's, absent when no contract refused. ethers puts a revert's data on
 * the error it throws, from a browser wallet or the node alike.
 */
export function refusal(error: unknown): { name?: string; message: string } {
  if (isError(error, "ACTION_REJECTED")) {
    return {
      message: "You cancelled the request in your wallet. Nothing was sent.",
    };
  }
  const { data, shortMessage } =
    (error as { data?: string; shortMessage?: string } | undefined) ?? {};
  let parsed = null;
  try {
    parsed = data ? ABI.parseError(data) : null;
  } catch {
    // "0x" from an empty revert, or arguments cut short: nothing to name.
  }
  if (!parsed) {
    // No revert data the ABI knows: an empty revert or a failed connection.
    return { message: shortMessage ?? String(error) };
  }
  const { name, args } = parsed;
  return {
    name,
    message:
      MESSAGES[name]?.([...args]) ??
      `The contract refused this action (${name}).`,
  };
}

/**
 * Every transaction goes through here: the Dialog while a wallet asks the
 * viewer to sign, a Toast once the block has it, a RefusalNotice if not, then
 * the log again. The Dialog never stays open, whatever happens.
 *
 * @param sign asks for the signature and resolves once the wallet has signed
 * @param ui.prompt false when the local node signs, which asks nobody
 */
export async function send(
  action: { signing: string; done: Done; refused: string },
  sign: () => Promise<{ wait(): Promise<unknown> }>,
  ui: {
    prompt: boolean;
    setSigning(signing?: string): void;
    setToast(toast?: Done): void;
    setNotice(notice?: Notice): void;
    reload(): Promise<void>;
  },
) {
  ui.setNotice(undefined);
  ui.setToast(undefined);
  if (ui.prompt) ui.setSigning(action.signing);
  try {
    const tx = await sign();
    // Signed: what is left is the chain's, not the wallet's.
    ui.setSigning(undefined);
    await tx.wait();
    ui.setToast(action.done);
  } catch (error) {
    const { name, message } = refusal(error);
    ui.setNotice({
      variant: "destructive",
      title: action.refused,
      description: message,
      code: name,
    });
  }
  ui.setSigning(undefined);
  await ui.reload();
}
