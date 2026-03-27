export interface Vendor {
    vendorId: string
    name: string
    desc: string
    link: string
    importConfigJson?: string | null
    logoFileName?: string | null
    logoDataUrl?: string | null
}
