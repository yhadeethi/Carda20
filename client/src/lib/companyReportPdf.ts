import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ContactV2 } from "./contacts/storage";
import type { Company } from "./companiesStorage";
import type { CompanyIntelData, CompanyIntelV2 } from "@shared/schema";

interface ReportData {
  company: Company;
  contacts: ContactV2[];
  intel?: CompanyIntelData | null;
  intelV2?: CompanyIntelV2 | null;
}

const COLORS = {
  primary: [30, 64, 175] as [number, number, number],
  darkText: [15, 23, 42] as [number, number, number],
  mediumText: [71, 85, 105] as [number, number, number],
  lightText: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
};

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(title, 20, y);

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(20, y + 2, 190, y + 2);

  return y + 10;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number, color: [number, number, number], fontStyle: string = "normal"): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", fontStyle);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.45);
}

function checkPageBreak(doc: jsPDF, y: number, needed: number = 30): number {
  const pageHeight = doc.internal.pageSize.height;
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 25;
  }
  return y;
}

function buildOrgTree(contacts: ContactV2[]): { roots: ContactV2[]; childrenMap: Map<string, ContactV2[]> } {
  const childrenMap = new Map<string, ContactV2[]>();
  const roots: ContactV2[] = [];

  contacts.forEach((c) => {
    const managerId = c.org?.reportsToId;
    if (managerId && contacts.some((m) => m.id === managerId)) {
      const children = childrenMap.get(managerId) || [];
      children.push(c);
      childrenMap.set(managerId, children);
    } else {
      roots.push(c);
    }
  });

  return { roots, childrenMap };
}

function drawOrgNode(doc: jsPDF, contact: ContactV2, x: number, y: number, nodeWidth: number): number {
  const name = contact.name || contact.email || "Unknown";
  const title = contact.title || "";
  const dept = contact.org?.department || "UNKNOWN";

  const nodeHeight = title ? 22 : 16;
  const bottomY = y + nodeHeight;

  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(x, y, nodeWidth, nodeHeight, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.darkText);
  const truncName = name.length > 28 ? name.substring(0, 26) + "..." : name;
  doc.text(truncName, x + 4, y + 7);

  if (title) {
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.mediumText);
    const truncTitle = title.length > 35 ? title.substring(0, 33) + "..." : title;
    doc.text(truncTitle, x + 4, y + 13);
  }

  doc.setFontSize(5.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...COLORS.lightText);
  doc.text(dept, x + 4, y + (title ? 18 : 12));

  return bottomY;
}

function drawOrgTree(
  doc: jsPDF,
  node: ContactV2,
  childrenMap: Map<string, ContactV2[]>,
  x: number,
  y: number,
  nodeWidth: number,
  depth: number = 0
): number {
  y = checkPageBreak(doc, y, 35);

  const indentX = x + depth * 12;
  const availWidth = Math.min(nodeWidth, 190 - indentX);

  if (depth > 0) {
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(indentX - 8, y + 8, indentX, y + 8);
    doc.line(indentX - 8, y - 4, indentX - 8, y + 8);
  }

  const bottomY = drawOrgNode(doc, node, indentX, y, availWidth);
  let currentY = bottomY + 4;

  const children = childrenMap.get(node.id) || [];
  children.forEach((child) => {
    currentY = drawOrgTree(doc, child, childrenMap, x, currentY, nodeWidth, depth + 1);
  });

  return currentY;
}

export async function generateCompanyReport(data: ReportData): Promise<void> {
  const { company, contacts, intel, intelV2 } = data;
  const doc = new jsPDF("p", "mm", "a4");
  let y = 20;

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(company.name, 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.mediumText);
  const subline = [company.domain, `${contacts.length} contacts`].filter(Boolean).join("  |  ");
  doc.text(subline, 20, y);
  y += 4;

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.lightText);
  doc.text(`Generated ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`, 20, y);
  y += 10;

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(20, y, 190, y);
  y += 10;

  const summary =
    intelV2?.summary ||
    intel?.companySnapshot ||
    intel?.snapshot?.description ||
    null;

  if (summary) {
    y = addSectionTitle(doc, "Company Brief", y);
    y = addWrappedText(doc, summary, 20, y, 170, 10, COLORS.darkText);
    y += 8;
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, "Fact Sheet", y);

  const facts: [string, string][] = [];

  if (company.domain) facts.push(["Website", company.domain]);

  const industry = intelV2?.industry || intel?.snapshot?.industry;
  if (industry) facts.push(["Industry", industry]);

  const founded = intelV2?.founded || intel?.snapshot?.founded;
  if (founded) facts.push(["Founded", founded]);

  const employees = intel?.snapshot?.employees;
  const headcount = intelV2?.headcount?.range;
  if (headcount) facts.push(["Employees", headcount]);
  else if (employees) facts.push(["Employees", employees]);

  const hq = intelV2?.hq;
  if (hq) {
    const hqStr = [hq.city, hq.country].filter(Boolean).join(", ");
    if (hqStr) facts.push(["Headquarters", hqStr]);
  } else {
    const hqParts = [company.city, company.state, company.country].filter(Boolean);
    if (hqParts.length > 0) facts.push(["Headquarters", hqParts.join(", ")]);
  }

  if (intelV2?.founderOrCeo) facts.push(["CEO / Founder", intelV2.founderOrCeo]);

  if (intelV2?.revenue) facts.push(["Revenue", intelV2.revenue]);
  if (intelV2?.funding?.totalRaised) facts.push(["Total Funding", intelV2.funding.totalRaised]);
  if (intelV2?.funding?.latestRound) facts.push(["Latest Round", intelV2.funding.latestRound]);

  if (intel?.funding?.stage) facts.push(["Funding Stage", intel.funding.stage]);
  if (intel?.funding?.totalRaised && !intelV2?.funding?.totalRaised) facts.push(["Total Raised", intel.funding.totalRaised]);

  const socials: [string, string][] = [];
  if (intelV2?.linkedinUrl) socials.push(["LinkedIn", intelV2.linkedinUrl]);
  if (intelV2?.twitterUrl) socials.push(["Twitter/X", intelV2.twitterUrl]);
  if (intelV2?.facebookUrl) socials.push(["Facebook", intelV2.facebookUrl]);
  if (intelV2?.instagramUrl) socials.push(["Instagram", intelV2.instagramUrl]);

  if (facts.length > 0 || socials.length > 0) {
    const allRows = [...facts, ...socials];
    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: allRows,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.darkText,
      },
      alternateRowStyles: {
        fillColor: COLORS.headerBg,
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 45 },
        1: { cellWidth: "auto" },
      },
      margin: { left: 20, right: 20 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (intel?.whyTheyMatterToYou && intel.whyTheyMatterToYou.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, "Why They Matter", y);
    intel.whyTheyMatterToYou.forEach((point) => {
      y = checkPageBreak(doc, y, 10);
      y = addWrappedText(doc, `• ${point}`, 24, y, 166, 9, COLORS.darkText);
      y += 2;
    });
    y += 6;
  }

  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, "Employee Directory", y);

  if (contacts.length === 0) {
    y = addWrappedText(doc, "No contacts recorded for this company.", 20, y, 170, 10, COLORS.lightText, "italic");
    y += 8;
  } else {
    const deptLabels: Record<string, string> = {
      EXEC: "Exec",
      LEGAL: "Legal",
      PROJECT_DELIVERY: "Project Delivery",
      SALES: "Sales",
      FINANCE: "Finance",
      OPS: "Ops",
      UNKNOWN: "Unknown",
    };

    const sortedContacts = [...contacts].sort((a, b) => {
      const deptOrder = ["EXEC", "LEGAL", "PROJECT_DELIVERY", "SALES", "FINANCE", "OPS", "UNKNOWN"];
      const deptA = deptOrder.indexOf(a.org?.department || "UNKNOWN");
      const deptB = deptOrder.indexOf(b.org?.department || "UNKNOWN");
      if (deptA !== deptB) return deptA - deptB;
      return (a.name || "").localeCompare(b.name || "");
    });

    const tableData = sortedContacts.map((c) => [
      c.name || "—",
      c.title || "—",
      deptLabels[c.org?.department || "UNKNOWN"] || "Unknown",
      c.email || "—",
      c.phone || "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Name", "Title", "Dept", "Email", "Phone"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: COLORS.darkText,
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: COLORS.headerBg,
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 32 },
        1: { cellWidth: 38 },
        2: { cellWidth: 22 },
        3: { cellWidth: 42 },
        4: { cellWidth: 28 },
      },
      margin: { left: 20, right: 20 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (contacts.length > 1) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, "Organizational Chart", y);

    const contactsWithOrg = contacts.filter(
      (c) => c.org?.reportsToId || c.org?.department !== "UNKNOWN"
    );
    const orgContacts = contactsWithOrg.length > 0 ? contacts : contacts;

    const { roots, childrenMap } = buildOrgTree(orgContacts);

    if (roots.length === 0) {
      y = addWrappedText(
        doc,
        "No reporting relationships defined. Assign managers in the Org tab to see the hierarchy.",
        20,
        y,
        170,
        9,
        COLORS.lightText,
        "italic"
      );
    } else {
      roots.forEach((root) => {
        y = drawOrgTree(doc, root, childrenMap, 20, y, 80);
        y += 2;
      });
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.lightText);
    doc.text(
      `Carda Report  |  ${company.name}  |  Page ${i} of ${totalPages}`,
      105,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  const filename = `${company.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
