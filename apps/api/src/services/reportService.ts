import {
  getAdminReport,
  getAgentReport,
  getDeveloperReport,
  getFinanceAdminReport,
  type AgentReportData,
  type AdminReportData,
  type DeveloperReportData,
  type FinanceAdminReportData

} from "../queries/reportQueries";

export async function getAgentReportService(
  agentId: string,
): Promise<AgentReportData> {
  return getAgentReport(agentId);
}

export async function getDeveloperReportService(
  developerId: string,
): Promise<DeveloperReportData> {
  return getDeveloperReport(developerId);
}

export async function getAdminReportService(): Promise<AdminReportData> {
  return getAdminReport();
}

export async function getFinanceAdminReportService(): Promise<FinanceAdminReportData> {
  return getFinanceAdminReport();
}
