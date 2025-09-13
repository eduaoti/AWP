export interface Ioption {
    title: string;
    specUrl: string;
    nonce?: string;
    redocOptions?: object;
}
declare function redocHtml(options?: Ioption): string;
export { redocHtml };
export default redocHtml;
