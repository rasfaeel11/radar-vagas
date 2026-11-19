import { describe, expect, it } from "vitest";
import { limparHtml } from "./html.js";

describe("limparHtml", () => {
  it("desescapa HTML escapado do Greenhouse e remove tags", () => {
    const entrada =
      "&lt;div&gt;&lt;p&gt;Venha trabalhar com &lt;strong&gt;Node.js &amp;amp; TypeScript&lt;/strong&gt;.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;PostgreSQL&lt;/li&gt;&lt;li&gt;AWS&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;";
    expect(limparHtml(entrada)).toBe("Venha trabalhar com Node.js & TypeScript .\nPostgreSQL\nAWS");
  });

  it("trata <br>, entidades numéricas e &nbsp;", () => {
    const entrada = "<p>Linha&nbsp;1<br/>Linha&#32;2 &#x2014; fim</p>";
    expect(limparHtml(entrada)).toBe("Linha 1\nLinha 2 — fim");
  });

  it("devolve string vazia para entrada vazia", () => {
    expect(limparHtml("")).toBe("");
  });
});
