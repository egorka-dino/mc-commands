import type { Metadata } from "next";
import { StructureStudio } from "../components/structures/StructureStudio";
export const metadata: Metadata = { title: "Structure Studio — mc-commands" };
export default function StructuresPage() {
  return <>
    <header><h1>STRUCTURE STUDIO</h1><p>Собери пространство и посмотри на него изнутри</p></header>
    <main className="container structure-container"><StructureStudio /></main>
  </>;
}
