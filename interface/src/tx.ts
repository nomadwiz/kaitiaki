// The interface's whole ABI (#150, FR41): the write functions the screens
// call, and every custom error of the six contracts and MockNZD, so a refusal
// decodes to the RefusalNotice message for it (interface.md §3). `send` is
// the one path every transaction takes. No `view` or
// `pure` fragment: the interface cannot read storage through an ABI that has
// none. Signatures are copied from the compiled contracts; test/interface.ts
// fails if one drifts or a contract gains an error missing here.
import { Interface, MaxUint256, isError, type Provider } from "ethers";

import { date, nzd } from "./format.js";
import type { Done, Notice } from "./states.js";

export const ABI = new Interface([
  "function castVote(uint256 proposalId, bool inFavour) returns (uint256 weight)",
  // Paying a levy: the token approval, then the ledger takes the payment
  "function approve(address spender, uint256 value) returns (bool)",
  "function payLevy(uint256 chargeId)",
  // Anyone's actions: each waits for its date, and any wallet may call it
  "function queue(uint256 proposalId) returns (uint256 eta)",
  "function execute(uint256 proposalId)",
  // The firm's: propose work, propose a vendor (the overload, ADR-018), and
  // confirm the work done
  "function propose(string description, uint256 limit, uint8 fund, address vendor, bytes32 quoteHash) returns (uint256 proposalId)",
  "function propose(address vendor, string name, string companyId) returns (uint256 proposalId)",
  "function attest(uint256 proposalId, bytes32 evidenceHash)",
  // The firm collects due levies from owners' wallets (ADR-020)
  "function collect(uint256[] chargeIds)",
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
  // LevyLedger; TreasuryIsZero, MembershipRegistryIsZero, FirmIsZero and
  // NotFirm are Governance's too
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
    `This charge cannot be collected before ${date(dueDate)}.`,
  NotFirm: () => "Only the management firm’s wallet can do this.",
  AlreadyAttested: () => "The firm has already confirmed this work.",
  EvidenceHashIsZero: () => "Add the evidence hash before confirming.",
  NotPassed: () => "Only a proposal that passed can be queued.",
  AlreadyQueued: () => "This proposal is already queued.",
  NotQueued: () => "This proposal is not queued for payment.",
  AlreadyExecuted: () => "This proposal has already been carried out.",
  UnknownProposal: () => "There is no proposal with that number.",
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

// The Dialog, Toast and RefusalNotice words for paying a charge, which takes
// two signatures: the approval, then the payment.
export const payment = (unitId: bigint, chargeId: bigint, amount: bigint) => ({
  signing: `payment of Charge #${chargeId}, ${nzd(amount)}, for Unit ${unitId}. Two signatures are needed, one to approve the levy ledger and one to pay`,
  done: {
    title: "Levy paid",
    body: `Charge #${chargeId}, ${nzd(amount)}, is paid for Unit ${unitId}.`,
  },
  refused: "Your payment was not made",
});

// The two events that decide how much the levy ledger may still take from
// `owner`: the token's Approval sets it, and the ledger's LevyPaid spends it,
// because the ledger moves an owner's NZD only by `transferFrom` in `_pay`.
const ALLOWANCE = new Interface([
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event LevyPaid(uint256 indexed chargeId, uint256 indexed unitId, address indexed payer, uint256 amount)",
]);

/**
 * The levy ledger's standing approval from `owner`, rebuilt from events alone
 * (FR41): the last Approval to the ledger, less every LevyPaid after it that
 * `owner` paid. OpenZeppelin's ERC-20 emits no Approval when an allowance is
 * spent, so the payments are needed, and it never spends an unlimited one.
 * Paying by hand approves this plus the charge, so a direct debit survives it.
 */
export async function standingApproval(
  provider: Pick<Provider, "getLogs">,
  token: string,
  levyLedger: string,
  owner: string,
  fromBlock: number,
) {
  const [approvals, payments] = await Promise.all([
    provider.getLogs({
      address: token,
      fromBlock,
      topics: ALLOWANCE.encodeFilterTopics("Approval", [owner, levyLedger]),
    }),
    provider.getLogs({
      address: levyLedger,
      fromBlock,
      topics: ALLOWANCE.encodeFilterTopics("LevyPaid", [null, null, owner]),
    }),
  ]);
  let allowance = 0n;
  for (const log of [...approvals, ...payments].sort(
    (a, b) => a.blockNumber - b.blockNumber || a.index - b.index,
  )) {
    const { name, args } = ALLOWANCE.parseLog(log)!;
    if (name === "Approval") allowance = args.value;
    else if (allowance !== MaxUint256) allowance -= args.amount;
  }
  return allowance;
}

// Setting up direct debit: one approval, for every unpaid charge (ADR-020).
export const directDebit = (total: bigint) => ({
  signing: `approving the levy ledger to collect up to ${nzd(total)} from this wallet`,
  done: {
    title: "Direct debit set up",
    body: `The firm can now collect up to ${nzd(total)} of your levies as they fall due.`,
  },
  refused: "Direct debit was not set up",
});

// The same for Anyone's actions, which take one signature each.
export const queue = (proposalId: bigint) => ({
  signing: `queueing Proposal #${proposalId}`,
  done: {
    title: "Proposal queued",
    body: `Proposal #${proposalId} is queued for payment.`,
  },
  refused: "The proposal was not queued",
});
export const carryOut = (proposalId: bigint) => ({
  signing: `carrying out Proposal #${proposalId}`,
  done: {
    title: "Proposal carried out",
    body: `Proposal #${proposalId} has been carried out.`,
  },
  refused: "This proposal cannot be carried out yet",
});

// The same for the firm's workspace, one signature each.
export const proposeWork = (description: string) => ({
  signing: `proposing the work “${description}”`,
  done: {
    title: "Work proposed",
    body: `“${description}” is proposed for owners to vote on.`,
  },
  refused: "The work was not proposed",
});
export const proposeVendor = (name: string) => ({
  signing: `proposing ${name} as a vendor`,
  done: {
    title: "Vendor proposed",
    body: `${name} is proposed as a vendor for owners to vote on.`,
  },
  refused: "The vendor was not proposed",
});
export const confirmWork = (proposalId: bigint) => ({
  signing: `that the work on Proposal #${proposalId} is done`,
  done: {
    title: "Work confirmed",
    body: `The work on Proposal #${proposalId} is confirmed as done.`,
  },
  refused: "The work was not confirmed",
});
export const collectLevies = (count: number) => ({
  signing: `collecting ${count} due levy charge${count === 1 ? "" : "s"} from owners' wallets`,
  done: {
    title: "Levies collected",
    body: `${count} due charge${count === 1 ? "" : "s"} collected. Any an owner's wallet did not cover ${count === 1 ? "is" : "are"} recorded as owed.`,
  },
  refused: "The levies were not collected",
});

/**
 * Why a transaction did not happen, in plain words. `name` is the contract
 * error's, absent when no contract refused; `cancelled` is set when the
 * viewer cancelled in the wallet, which is a toast, not an Alert. ethers puts
 * a revert's data on the error it throws, from a browser wallet or the node
 * alike.
 */
export function refusal(error: unknown): {
  name?: string;
  message: string;
  cancelled?: true;
} {
  if (isError(error, "ACTION_REJECTED")) {
    return {
      message: "You cancelled the request in your wallet. Nothing was sent.",
      cancelled: true,
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
 * `refusal` for a payment whose approval was already mined: "Nothing was
 * sent" would be untrue, because the levy ledger stays approved.
 */
export function approvedRefusal(error: unknown) {
  const r = refusal(error);
  // Its own message says the approval fell short, so "stands" would contradict.
  if (r.name === "ERC20InsufficientAllowance") return r;
  const stands =
    "The approval was already sent, so the levy ledger stays approved for that amount.";
  // Not `cancelled`: the charge is still to pay, so this stays as an Alert.
  return r.cancelled
    ? {
        message: `You cancelled the payment in your wallet. ${stands} Press Pay to try again.`,
      }
    : { ...r, message: `${r.message} ${stands}` };
}

/**
 * Every transaction goes through here: the Dialog while a wallet asks the
 * viewer to sign, a toast once the block has it or if the viewer cancelled in
 * the wallet, a RefusalNotice if refused, then the log again. The Dialog
 * closes once the wallet has signed, refused or cancelled. Resolves true if
 * the transaction was mined, so a form can be cleared only then.
 *
 * @param sign asks for the signature and resolves once the wallet has signed
 * @param ui.prompt false when the local node signs, which asks nobody
 */
export async function send(
  action: {
    signing: string;
    done: Done;
    refused: string;
    // Words the refusal in place of `refusal`, when the action knows more.
    refuse?: typeof refusal;
  },
  sign: () => Promise<{ wait(): Promise<unknown> }>,
  ui: {
    prompt: boolean;
    setSigning(signing?: string): void;
    toast(toast: Done): void;
    setNotice(notice?: Notice): void;
    reload(): Promise<void>;
  },
) {
  ui.setNotice(undefined);
  let sent = false;
  if (ui.prompt) ui.setSigning(action.signing);
  try {
    const tx = await sign();
    // Signed: what is left is the chain's, not the wallet's.
    ui.setSigning(undefined);
    await tx.wait();
    ui.toast(action.done);
    sent = true;
  } catch (error) {
    const { name, message, cancelled } = (action.refuse ?? refusal)(error);
    if (cancelled) {
      ui.toast({ title: message, cancelled });
    } else {
      ui.setNotice({
        variant: "destructive",
        title: action.refused,
        description: message,
        code: name,
      });
    }
  }
  ui.setSigning(undefined);
  await ui.reload();
  return sent;
}
