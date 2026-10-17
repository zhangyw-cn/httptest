export function installDomShim() {
  if ((globalThis.document as { __httptestShim?: boolean } | undefined)?.__httptestShim) {
    return;
  }

  type MiniNode = {
    nodeType: number;
    nodeName: string;
    nodeValue: string | null;
    parentNode: MiniNode | null;
    ownerDocument: MiniDocument | null;
    childNodes: MiniNode[];
    appendChild: (child: MiniNode) => MiniNode;
    removeChild: (child: MiniNode) => MiniNode;
    insertBefore: (child: MiniNode, ref: MiniNode | null) => MiniNode;
    firstChild: MiniNode | null;
    lastChild: MiniNode | null;
    nextSibling: MiniNode | null;
    previousSibling: MiniNode | null;
    textContent: string;
  };

  type MiniDocument = MiniNode & {
    __httptestShim: boolean;
    body: MiniElement;
    documentElement: MiniElement;
    head: MiniElement;
    defaultView: unknown;
    readyState: string;
    createElement: (tag: string) => MiniElement;
    createElementNS: (ns: string, tag: string) => MiniElement;
    createTextNode: (data: string) => MiniNode;
    createComment: (data: string) => MiniNode;
    addEventListener: () => void;
    removeEventListener: () => void;
  };

  type MiniElement = MiniNode & {
    tagName: string;
    namespaceURI: string;
    style: { setProperty: (name: string, value: string) => void } & Record<
      string,
      string | ((name: string, value: string) => void)
    >;
    setAttribute: (name: string, value: string) => void;
    getAttribute: (name: string) => string | null;
    removeAttribute: (name: string) => void;
    addEventListener: () => void;
    removeEventListener: () => void;
    className: string;
    innerHTML: string;
  };

  function proto(base: object): MiniNode {
    const node = base as MiniNode;
    node.childNodes = [];
    if (node.parentNode === undefined) node.parentNode = null;
    if (node.ownerDocument === undefined) node.ownerDocument = null;
    if (node.nodeValue === undefined) node.nodeValue = null;
    node.appendChild = function (child: MiniNode) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      node.childNodes.push(child);
      return child;
    };
    node.removeChild = function (child: MiniNode) {
      const index = node.childNodes.indexOf(child);
      if (index === -1) throw new Error("not a child");
      node.childNodes.splice(index, 1);
      child.parentNode = null;
      return child;
    };
    node.insertBefore = function (child: MiniNode, ref: MiniNode | null) {
      if (ref == null) return node.appendChild(child);
      if (child.parentNode) child.parentNode.removeChild(child);
      const index = node.childNodes.indexOf(ref);
      child.parentNode = node;
      node.childNodes.splice(index, 0, child);
      return child;
    };
    Object.defineProperties(node, {
      firstChild: {
        get() {
          return node.childNodes[0] ?? null;
        },
      },
      lastChild: {
        get() {
          return node.childNodes[node.childNodes.length - 1] ?? null;
        },
      },
      nextSibling: {
        get() {
          if (!node.parentNode) return null;
          const index = node.parentNode.childNodes.indexOf(node);
          return node.parentNode.childNodes[index + 1] ?? null;
        },
      },
      previousSibling: {
        get() {
          if (!node.parentNode) return null;
          const index = node.parentNode.childNodes.indexOf(node);
          return node.parentNode.childNodes[index - 1] ?? null;
        },
      },
    });
    return node;
  }

  let doc: MiniDocument;

  function createElement(tag: string): MiniElement {
    const attributes = new Map<string, string>();
    const style: MiniElement["style"] = {
      setProperty(name: string, value: string) {
        style[name] = value;
      },
    };
    const el = proto({
      nodeType: 1,
      nodeName: tag.toUpperCase(),
      tagName: tag.toUpperCase(),
      namespaceURI: "http://www.w3.org/1999/xhtml",
      ownerDocument: doc as MiniDocument,
      style,
      setAttribute(name: string, value: string) {
        attributes.set(name, String(value));
      },
      getAttribute(name: string) {
        return attributes.has(name) ? attributes.get(name)! : null;
      },
      removeAttribute(name: string) {
        attributes.delete(name);
      },
      addEventListener() {},
      removeEventListener() {},
    }) as MiniElement;
    Object.defineProperties(el, {
      className: {
        get() {
          return attributes.get("class") ?? "";
        },
        set(value: string) {
          attributes.set("class", String(value));
        },
      },
      textContent: {
        get() {
          return el.childNodes.map((child) => child.textContent ?? "").join("");
        },
        set(value: string) {
          el.childNodes = [];
          if (value) el.appendChild(doc.createTextNode(String(value)));
        },
      },
      innerHTML: {
        get() {
          return el.childNodes.map((child) => child.textContent ?? "").join("");
        },
        set() {
          el.childNodes = [];
        },
      },
    });
    return el;
  }

  doc = proto({
    nodeType: 9,
    nodeName: "#document",
    __httptestShim: true,
    readyState: "complete",
    addEventListener() {},
    removeEventListener() {},
    createElement,
    createElementNS(_ns: string, tag: string) {
      const el = createElement(tag);
      el.namespaceURI = _ns;
      return el;
    },
    createTextNode(data: string) {
      const text = proto({
        nodeType: 3,
        nodeName: "#text",
        nodeValue: String(data),
      });
      Object.defineProperty(text, "textContent", {
        get() {
          return text.nodeValue ?? "";
        },
        set(value: string) {
          text.nodeValue = String(value);
        },
      });
      text.ownerDocument = doc as MiniDocument;
      return text;
    },
    createComment(data: string) {
      const comment = proto({
        nodeType: 8,
        nodeName: "#comment",
        nodeValue: String(data),
      });
      comment.ownerDocument = doc as MiniDocument;
      return comment;
    },
  }) as MiniDocument;
  doc.ownerDocument = doc;
  doc.documentElement = createElement("html");
  doc.head = createElement("head");
  doc.body = createElement("body");
  doc.documentElement.ownerDocument = doc;
  doc.head.ownerDocument = doc;
  doc.body.ownerDocument = doc;
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);

  function HTMLIFrameElement() {}
  const windowObj = {
    document: doc,
    HTMLIFrameElement,
    addEventListener() {},
    removeEventListener() {},
    navigator: { userAgent: "httptest" },
    location: { href: "http://localhost/" },
    top: null as unknown,
    self: null as unknown,
    window: null as unknown,
  };
  windowObj.top = windowObj;
  windowObj.self = windowObj;
  windowObj.window = windowObj;
  doc.defaultView = windowObj;

  globalThis.window = windowObj as unknown as Window & typeof globalThis;
  globalThis.document = doc as unknown as Document;
}

export function uninstallDomShim() {
  const doc = globalThis.document as { __httptestShim?: boolean } | undefined;
  if (!doc?.__httptestShim) return;
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
}
