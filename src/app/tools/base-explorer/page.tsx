"use client";

import React, { useState, useCallback } from 'react';
import { PixelCard } from '@/components/PixelCard';
import { PixelButton } from '@/components/PixelButton';

const base64Encode = (str: string): string => {
    try {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    } catch { return 'Error: Invalid input'; }
};

const base64Decode = (str: string): string => {
    try {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch { return 'Error: Invalid Base64'; }
};

const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (str: string): string => {
    try {
        const bytes = new TextEncoder().encode(str);
        let bits = '';
        bytes.forEach(b => bits += b.toString(2).padStart(8, '0'));
        while (bits.length % 5 !== 0) bits += '0';
        let result = '';
        for (let i = 0; i < bits.length; i += 5) {
            result += base32Chars[parseInt(bits.slice(i, i + 5), 2)];
        }
        while (result.length % 8 !== 0) result += '=';
        return result;
    } catch { return 'Error: Invalid input'; }
};

const base32Decode = (str: string): string => {
    try {
        const cleaned = str.replace(/=+$/, '').toUpperCase();
        let bits = '';
        for (const char of cleaned) {
            const idx = base32Chars.indexOf(char);
            if (idx === -1) throw new Error('Invalid character');
            bits += idx.toString(2).padStart(5, '0');
        }
        const bytes: number[] = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.slice(i, i + 8), 2));
        }
        return new TextDecoder().decode(new Uint8Array(bytes));
    } catch { return 'Error: Invalid Base32'; }
};

const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const base58Encode = (str: string): string => {
    try {
        const bytes = new TextEncoder().encode(str);
        let leadingZeros = 0;
        while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
        let num = BigInt(0);
        for (const b of bytes) num = num * 256n + BigInt(b);
        if (num === 0n) return base58Chars[0].repeat(leadingZeros || 1);
        let result = '';
        while (num > 0n) {
            result = base58Chars[Number(num % 58n)] + result;
            num = num / 58n;
        }
        result = base58Chars[0].repeat(leadingZeros) + result;
        return result;
    } catch { return 'Error: Invalid input'; }
};

const base58Decode = (str: string): string => {
    try {
        let leadingZeros = 0;
        while (leadingZeros < str.length && str[leadingZeros] === base58Chars[0]) leadingZeros++;
        let num = BigInt(0);
        for (const char of str) {
            const idx = base58Chars.indexOf(char);
            if (idx === -1) throw new Error('Invalid character');
            num = num * 58n + BigInt(idx);
        }
        let hex = num.toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex;
        const bytes: number[] = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.slice(i, i + 2), 16));
        }
        const result = new Uint8Array(leadingZeros + bytes.length);
        result.set(new Uint8Array(leadingZeros), 0);
        result.set(new Uint8Array(bytes), leadingZeros);
        return new TextDecoder().decode(result);
    } catch { return 'Error: Invalid Base58'; }
};

const base85Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

const base85Encode = (str: string): string => {
    try {
        const bytes = new TextEncoder().encode(str);
        const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
        padded.set(bytes);
        let result = '';
        for (let i = 0; i < padded.length; i += 4) {
            let num = (padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3];
            let chunk = '';
            for (let j = 0; j < 5; j++) {
                chunk = base85Chars[num % 85] + chunk;
                num = Math.floor(num / 85);
            }
            result += chunk;
        }
        const extra = (4 - (bytes.length % 4)) % 4;
        return extra === 0 ? result : result.slice(0, -extra);
    } catch { return 'Error: Invalid input'; }
};

const base85Decode = (str: string): string => {
    try {
        const extra = (5 - (str.length % 5)) % 5;
        const padded = str + base85Chars[84].repeat(extra);
        const bytes: number[] = [];
        for (let i = 0; i < padded.length; i += 5) {
            let num = 0;
            for (let j = 0; j < 5; j++) {
                const idx = base85Chars.indexOf(padded[i + j]);
                if (idx === -1) throw new Error('Invalid character');
                num = num * 85 + idx;
            }
            bytes.push((num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff);
        }
        const result = bytes.slice(0, bytes.length - extra);
        return new TextDecoder().decode(new Uint8Array(result));
    } catch { return 'Error: Invalid Base85'; }
};

const hexEncode = (str: string): string => {
    return Array.from(new TextEncoder().encode(str))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const hexDecode = (str: string): string => {
    try {
        const cleaned = str.replace(/\s/g, '');
        const bytes: number[] = [];
        for (let i = 0; i < cleaned.length; i += 2) {
            bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
        }
        return new TextDecoder().decode(new Uint8Array(bytes));
    } catch { return 'Error: Invalid Hex'; }
};

const binaryEncode = (str: string): string => {
    return Array.from(new TextEncoder().encode(str))
        .map(b => b.toString(2).padStart(8, '0'))
        .join(' ');
};

const binaryDecode = (str: string): string => {
    try {
        const bytes = str.split(/\s+/).filter(b => b).map(b => parseInt(b, 2));
        return new TextDecoder().decode(new Uint8Array(bytes));
    } catch { return 'Error: Invalid Binary'; }
};

type EncodingType = 'base64' | 'base32' | 'base58' | 'base85' | 'hex' | 'binary';

const encoders: Record<EncodingType, { encode: (s: string) => string; decode: (s: string) => string }> = {
    base64: { encode: base64Encode, decode: base64Decode },
    base32: { encode: base32Encode, decode: base32Decode },
    base58: { encode: base58Encode, decode: base58Decode },
    base85: { encode: base85Encode, decode: base85Decode },
    hex: { encode: hexEncode, decode: hexDecode },
    binary: { encode: binaryEncode, decode: binaryDecode },
};

export default function BaseExplorerPage() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [encoding, setEncoding] = useState<EncodingType>('base64');
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');

    const handleProcess = useCallback(() => {
        if (!input.trim()) {
            setOutput('⚠️ Input is empty');
            return;
        }
        const processor = encoders[encoding];
        const result = mode === 'encode' ? processor.encode(input) : processor.decode(input);
        setOutput(result);
    }, [input, encoding, mode]);

    const handleSwap = () => {
        setInput(output);
        setOutput('');
        setMode(mode === 'encode' ? 'decode' : 'encode');
    };

    const encodingTypes: { key: EncodingType; label: string; color: string }[] = [
        { key: 'base64', label: 'BASE64', color: 'neon' },
        { key: 'base32', label: 'BASE32', color: 'pink' },
        { key: 'base58', label: 'BASE58', color: 'retro' },
        { key: 'base85', label: 'BASE85', color: 'neon' },
        { key: 'hex', label: 'HEX', color: 'pink' },
        { key: 'binary', label: 'BINARY', color: 'retro' },
    ];

    return (
        <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 md:gap-8">
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 md:gap-8">
                <section className="flex flex-col gap-4 pt-4">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">📦</span>
                        <div>
                            <h1 className="text-fluid-2xl text-neon-green font-bold tracking-tighter">BASE_EXPLORER</h1>
                            <p className="text-fluid-xs text-gray-500 tracking-widest uppercase">Advanced Encoding & Decoding Toolkit</p>
                        </div>
                    </div>
                    <div className="h-[2px] bg-gradient-to-r from-neon-green/50 to-transparent"></div>
                </section>

                <PixelCard title="ENCODING_MATRIX" variant="primary" className="w-full">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap gap-2">
                            {encodingTypes.map(({ key, label, color }) => (
                                <button
                                    key={key}
                                    onClick={() => setEncoding(key)}
                                    className={`
                                        px-3 py-1.5 text-[10px] font-bold tracking-wider
                                        border-[length:var(--border-width)] border-black
                                        transition-all cursor-pointer
                                        ${encoding === key
                                            ? color === 'neon' ? 'bg-neon-green text-black' :
                                                color === 'pink' ? 'bg-cyber-pink text-white' : 'bg-retro-yellow text-black'
                                            : 'bg-pixel-gray text-white hover:bg-white/10'
                                        }
                                    `}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-black/40 border border-white/10">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Mode:</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMode('encode')}
                                    className={`px-4 py-1 text-[10px] font-bold border-[length:var(--border-width)] border-black transition-all cursor-pointer ${mode === 'encode' ? 'bg-neon-green text-black' : 'bg-transparent text-white hover:bg-white/10'}`}
                                >
                                    ENCODE
                                </button>
                                <button
                                    onClick={() => setMode('decode')}
                                    className={`px-4 py-1 text-[10px] font-bold border-[length:var(--border-width)] border-black transition-all cursor-pointer ${mode === 'decode' ? 'bg-cyber-pink text-white' : 'bg-transparent text-white hover:bg-white/10'}`}
                                >
                                    DECODE
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 bg-neon-green"></span>
                                    {mode === 'encode' ? 'Plain Text' : 'Encoded Data'}
                                </label>
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Paste encoded data...'}
                                    className="w-full h-40 bg-black/60 border-[length:var(--border-width)] border-white/20 p-4 text-sm font-mono text-white placeholder-gray-600 focus:border-neon-green focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 bg-cyber-pink"></span>
                                    {mode === 'encode' ? 'Encoded Output' : 'Decoded Text'}
                                </label>
                                <textarea
                                    value={output}
                                    readOnly
                                    placeholder="Output will appear here..."
                                    className="w-full h-40 bg-black/40 border-[length:var(--border-width)] border-white/10 p-4 text-sm font-mono text-neon-green placeholder-gray-700 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <PixelButton variant="neon" onClick={handleProcess}>
                                ⚡ {mode === 'encode' ? 'ENCODE' : 'DECODE'}
                            </PixelButton>
                            <PixelButton variant="pink" onClick={handleSwap}>
                                ⇄ SWAP
                            </PixelButton>
                            <PixelButton variant="retro" onClick={() => navigator.clipboard.writeText(output)}>
                                📋 COPY
                            </PixelButton>
                            <PixelButton variant="retro" onClick={() => { setInput(''); setOutput(''); }}>
                                🗑 CLEAR
                            </PixelButton>
                        </div>
                    </div>
                </PixelCard>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { title: 'Base64', desc: 'Standard 64-char encoding. Uses A-Z, a-z, 0-9, +, /', color: 'neon' },
                        { title: 'Base32', desc: 'RFC 4648 standard. Uses A-Z, 2-7 (32 chars)', color: 'pink' },
                        { title: 'Base58', desc: 'Bitcoin format. Excludes 0, O, I, l for clarity', color: 'retro' },
                    ].map((item) => (
                        <div key={item.title} className={`p-4 bg-pixel-gray/50 border-l-4 ${item.color === 'neon' ? 'border-neon-green' : item.color === 'pink' ? 'border-cyber-pink' : 'border-retro-yellow'}`}>
                            <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                            <p className="text-[10px] text-gray-400 leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
                <footer className="mt-8 pt-6 border-t border-white/10 text-center">
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                        "Mohon digunakan dengan bijak dan tidak merugikan pihak tertentu"
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">© 2026 Vinconium</p>
                </footer>
            </div>
        </main>
    );
}
