declare module 'epoch-timeago' {
  export default function timeago(epochMs: number): string;
}

declare module 'ngraph.fromdot' {
  import { Graph } from 'ngraph.graph';

  export default function fromDot(dotString: string): Graph;
}

declare module 'tweetnacl-util' {
  const naclUtil: {
    encodeBase64(input: Uint8Array): string;
  };

  export default naclUtil;
}
