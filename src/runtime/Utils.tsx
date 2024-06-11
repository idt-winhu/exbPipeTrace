
//import { React } from 'jimu-core';
import React, { useState } from 'react';

export const truncXML = (xml: string): string => {
  return  xml.replace("<?xml version=\"1.0\" encoding=\"utf-8\"?>","")
             .replace("<string xmlns=\"http://tempuri.org/\">","")
             .replace("</string>","");                        

};

interface HTMLElementAttributes {
  id?: string;
  className?: string;
  textContent?: string;
  style?: string;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes: HTMLElementAttributes,
  children?: HTMLElement[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (attributes.id) {
    element.id = attributes.id;
  }
  if (attributes.className) {
    element.className = attributes.className;
  }
  if (attributes.textContent) {
    element.textContent = attributes.textContent;
  }
  if (attributes.style) {
    element.style = attributes.style;
  }
  if (children) {
    children.forEach(child => element.appendChild(child));
  }
  return element;
}

