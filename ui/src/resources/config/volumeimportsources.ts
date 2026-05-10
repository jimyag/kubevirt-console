import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const volumeimportsourcesConfig: ResourceConfig = shared.cdiResourceConfig({ plural: "volumeimportsources", path: "/kubevirt/cdi/volume-import-sources", title: "VolumeImportSources", subtitle: "Manage CDI VolumeImportSource resources", kind: "VolumeImportSource", namespaced: true, createFields: [...shared.namespaceNameFields("example-import-source"), { name: "url", label: "HTTP URL", section: "Source", defaultValue: "https://example.com/disk.qcow2" }], buildSpec: (values) => ({ source: { http: { url: shared.stringValue(values.url, "https://example.com/disk.qcow2") } } }) });
