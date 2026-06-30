// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("swr", () => ({ default: vi.fn() }));
// Isolate from the api barrel — only listKey is needed (its return is fed to
// the mocked useSWR, which ignores it).
vi.mock("@/lib/api", () => ({
  rateContracts: {
    listKey: (p: { vendorId: string }) =>
      `/api/rate-contracts?vendorId=${p.vendorId}`,
  },
}));

import useSWR from "swr";
import { VendorRateContractsTab } from "@/app/(dashboard)/vendors/_components/VendorRateContractsTab";
import type { RateContractListRow } from "@/types";

const mockUseSWR = vi.mocked(useSWR);

function makeRow(over: Partial<RateContractListRow> = {}): RateContractListRow {
  return {
    id: "rc1",
    contract_number: "RC-2026-001",
    name: "The Leafy Haven",
    start_date: "2026-06-01",
    end_date: "2026-08-01",
    status: "active",
    item_count: 3,
    vendor_name: "Aegean Lighting Ltd.",
    vendor_kyc_status: "verified",
    ...over,
  } as RateContractListRow;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const swrResult = (over: Record<string, unknown>): any => ({
  data: undefined,
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
  ...over,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("VendorRateContractsTab", () => {
  it("renders nothing when the tab is disabled", () => {
    mockUseSWR.mockReturnValue(swrResult({}));
    const { container } = render(
      <VendorRateContractsTab vendorId="v1" enabled={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the empty state when the vendor has no contracts", () => {
    mockUseSWR.mockReturnValue(
      swrResult({ data: { rows: [], total: 0, page: 1, limit: 100 } })
    );
    render(<VendorRateContractsTab vendorId="v1" enabled />);
    expect(screen.getByText("rcEmptyTitle")).toBeDefined();
  });

  it("does not show the empty state or rows while loading", () => {
    mockUseSWR.mockReturnValue(swrResult({ data: undefined, isLoading: true }));
    render(<VendorRateContractsTab vendorId="v1" enabled />);
    expect(screen.queryByText("rcEmptyTitle")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("lists contracts and links each row to the rate-contract editor", () => {
    mockUseSWR.mockReturnValue(
      swrResult({ data: { rows: [makeRow()], total: 1, page: 1, limit: 100 } })
    );
    render(<VendorRateContractsTab vendorId="v1" enabled />);
    expect(screen.getByText("RC-2026-001")).toBeDefined();
    const link = screen.getByText("The Leafy Haven").closest("a");
    expect(link?.getAttribute("href")).toBe("/elements/rate-contracts/rc1");
  });

  it("shows the capped-count note only when total exceeds the rows shown", () => {
    mockUseSWR.mockReturnValue(
      swrResult({
        data: { rows: [makeRow()], total: 150, page: 1, limit: 100 },
      })
    );
    render(<VendorRateContractsTab vendorId="v1" enabled />);
    expect(screen.getByText(/rcShowingCount/)).toBeDefined();
    cleanup();

    mockUseSWR.mockReturnValue(
      swrResult({ data: { rows: [makeRow()], total: 1, page: 1, limit: 100 } })
    );
    render(<VendorRateContractsTab vendorId="v1" enabled />);
    expect(screen.queryByText(/rcShowingCount/)).toBeNull();
  });
});
