"use client";
import React, { useState, useCallback, useMemo } from 'react';
import { PixelCard } from '@/components/PixelCard';
import { PixelButton } from '@/components/PixelButton';

const generatePattern = (length: number): string => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    let pattern = '';
    for (let i = 0; i < upper.length && pattern.length < length; i++) {
        for (let j = 0; j < lower.length && pattern.length < length; j++) {
            for (let k = 0; k < digits.length && pattern.length < length; k++) {
                pattern += upper[i] + lower[j] + digits[k];
            }
        }
    }
    return pattern.slice(0, length);
};

const findPatternOffset = (pattern: string, value: string): number => {
    let search = value;
    if (/^(0x)?[0-9a-fA-F]+$/.test(value) && value.length <= 10) {
        const hex = value.replace(/^0x/, '');
        const bytes: number[] = [];
        for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
        if (bytes.length === 4) bytes.reverse();
        search = bytes.map(b => String.fromCharCode(b)).join('');
    }
    const fullPattern = generatePattern(5000);
    const idx = fullPattern.indexOf(search);
    return idx;
};

const hexToDec = (hex: string): string => {
    try { return BigInt(hex.startsWith('0x') ? hex : '0x' + hex).toString(10); } catch { return 'Invalid'; }
};
const decToHex = (dec: string): string => {
    try { return '0x' + BigInt(dec).toString(16).toUpperCase(); } catch { return 'Invalid'; }
};
const hexToBin = (hex: string): string => {
    try { return BigInt(hex.startsWith('0x') ? hex : '0x' + hex).toString(2); } catch { return 'Invalid'; }
};
const binToHex = (bin: string): string => {
    try { return '0x' + BigInt('0b' + bin).toString(16).toUpperCase(); } catch { return 'Invalid'; }
};
const binToDec = (bin: string): string => {
    try { return BigInt('0b' + bin).toString(10); } catch { return 'Invalid'; }
};
const decToBin = (dec: string): string => {
    try { return BigInt(dec).toString(2); } catch { return 'Invalid'; }
};

const calcOffset = (base: string, target: string): string => {
    try {
        const b = BigInt(base.startsWith('0x') ? base : '0x' + base);
        const t = BigInt(target.startsWith('0x') ? target : '0x' + target);
        const diff = t - b;
        const signed = diff > BigInt(0x7fffffff) ? diff - BigInt(0x100000000) : diff;
        return `Offset: ${diff.toString(10)} (0x${diff.toString(16).toUpperCase()})${signed !== diff ? ` / ${signed.toString(10)}` : ''}`;
    } catch { return 'Invalid addresses'; }
};

const packLittleEndian = (hex: string): string => {
    try {
        const clean = hex.replace(/^0x/, '');
        if (!/^[0-9a-fA-F]+$/.test(clean)) return 'Invalid hex';
        const padded = clean.length % 2 !== 0 ? '0' + clean : clean;
        const bytes = padded.match(/.{2}/g) || [];
        return bytes.reverse().map(b => '\\x' + b.toLowerCase()).join('');
    } catch { return 'Invalid hex'; }
};

const packBigEndian = (hex: string): string => {
    try {
        const clean = hex.replace(/^0x/, '');
        if (!/^[0-9a-fA-F]+$/.test(clean)) return 'Invalid hex';
        const padded = clean.length % 2 !== 0 ? '0' + clean : clean;
        const bytes = padded.match(/.{2}/g) || [];
        return bytes.map(b => '\\x' + b.toLowerCase()).join('');
    } catch { return 'Invalid hex'; }
};

type ToolType = 'converter' | 'pattern' | 'offset' | 'packing';

export default function PwnHelperPage() {
    const [tool, setTool] = useState<ToolType>('converter');
    const [input, setInput] = useState('');
    const [patternLen, setPatternLen] = useState(200);
    const [regenerate, setRegenerate] = useState(0);
    const [offsetResult, setOffsetResult] = useState('');
    const [baseAddr, setBaseAddr] = useState('');
    const [targetAddr, setTargetAddr] = useState('');
    const [addrCalcResult, setAddrCalcResult] = useState('');
    const [packResult, setPackResult] = useState({ le: '', be: '' });

    const pattern = useMemo(() => generatePattern(patternLen), [patternLen, regenerate]);

    const conversions = input ? {
        'HEX → DEC': /^(0x)?[0-9a-fA-F]+$/.test(input) ? hexToDec(input) : '-',
        'DEC → HEX': /^\d+$/.test(input) ? decToHex(input) : '-',
        'HEX → BIN': /^(0x)?[0-9a-fA-F]+$/.test(input) ? hexToBin(input) : '-',
        'BIN → HEX': /^[01]+$/.test(input) ? binToHex(input) : '-',
        'DEC → BIN': /^\d+$/.test(input) ? decToBin(input) : '-',
        'BIN → DEC': /^[01]+$/.test(input) ? binToDec(input) : '-',
    } : {};

    const handleGeneratePattern = useCallback(() => setRegenerate(c => c + 1), []);
    const handleFindOffset = useCallback(() => {
        const off = findPatternOffset(pattern, input);
        setOffsetResult(off >= 0 ? `Found at offset: ${off}` : 'Pattern not found');
    }, [input, pattern]);
    const handleCalcOffset = useCallback(() => setAddrCalcResult(calcOffset(baseAddr, targetAddr)), [baseAddr, targetAddr]);
    const handlePack = useCallback(() => setPackResult({ le: packLittleEndian(input), be: packBigEndian(input) }), [input]);

    const tools: { key: ToolType; label: string; icon: string }[] = [
        { key: 'converter', label: 'CONVERTER', icon: '🔢' },
        { key: 'pattern', label: 'CYCLIC PATTERN', icon: '🔄' },
        { key: 'offset', label: 'OFFSET CALC', icon: '📐' },
        { key: 'packing', label: 'ADDR PACKING', icon: '📦' },
    ];

    return (
        <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
                <section className="flex items-center gap-4 pt-4">
                    <span className="text-4xl">⚡</span>
                    <div><h1 className="text-fluid-2xl text-retro-yellow font-bold">PWN_HELPER</h1>
                        <p className="text-fluid-xs text-gray-500 uppercase tracking-widest">Binary Exploitation Toolkit</p></div>
                </section>
                <div className="h-[2px] bg-gradient-to-r from-retro-yellow/50 to-transparent"></div>

                <div className="flex flex-wrap gap-2">
                    {tools.map(t => (
                        <button key={t.key} onClick={() => setTool(t.key)}
                            className={`px-4 py-2 text-[10px] font-bold border-[length:var(--border-width)] border-black cursor-pointer flex items-center gap-2 ${tool === t.key ? 'bg-retro-yellow text-black' : 'bg-pixel-gray text-white hover:bg-white/10'}`}>
                            <span>{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                <PixelCard title={tools.find(t => t.key === tool)?.label || 'TOOL'} variant="primary">
                    <div className="flex flex-col gap-5">
                        {tool === 'converter' && (
                            <>
                                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter hex (0x...), decimal, or binary..." className="bg-black/60 border-[length:var(--border-width)] border-white/20 p-3 text-sm font-mono text-white placeholder-gray-600 focus:border-retro-yellow focus:outline-none" />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {Object.entries(conversions).map(([label, val]) => (
                                        <div key={label} className="p-3 bg-black/40 border border-white/10">
                                            <div className="text-[10px] text-gray-500">{label}</div>
                                            <div className="text-sm font-mono text-neon-green break-all">{val}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {tool === 'pattern' && (
                            <>
                                <div className="flex items-center gap-3">
                                    <input type="number" value={patternLen} onChange={e => setPatternLen(Math.min(10000, parseInt(e.target.value) || 200))} className="w-32 bg-black/60 border border-white/20 p-2 text-sm font-mono text-white focus:outline-none" />
                                    <PixelButton variant="retro" onClick={handleGeneratePattern}>⚡ GENERATE</PixelButton>
                                </div>
                                {pattern && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] text-gray-500 uppercase">Pattern ({pattern.length} chars)</label>
                                            <button onClick={() => navigator.clipboard.writeText(pattern)} className="text-[10px] text-neon-green hover:underline cursor-pointer">Copy</button>
                                        </div>
                                        <div className="bg-black/40 border border-white/10 p-3 text-[10px] font-mono text-neon-green break-all max-h-40 overflow-auto">{pattern}</div>
                                    </div>
                                )}
                                <div className="border-t border-white/10 pt-4">
                                    <label className="text-[10px] text-gray-500 uppercase mb-2 block">Find Offset</label>
                                    <div className="flex gap-2">
                                        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter EIP value (0x41414141 or Aa0A)..." className="flex-1 bg-black/60 border border-white/20 p-2 text-sm font-mono text-white focus:outline-none" />
                                        <PixelButton variant="neon" onClick={handleFindOffset}>🔍 FIND</PixelButton>
                                    </div>
                                    {offsetResult && <div className="mt-2 p-3 bg-black/40 border border-white/10 text-sm font-mono text-retro-yellow">{offsetResult}</div>}
                                </div>
                            </>
                        )}

                        {tool === 'offset' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 uppercase">Base Address</label>
                                        <input value={baseAddr} onChange={e => setBaseAddr(e.target.value)} placeholder="0x08048000" className="bg-black/60 border border-white/20 p-2 text-sm font-mono text-white focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 uppercase">Target Address</label>
                                        <input value={targetAddr} onChange={e => setTargetAddr(e.target.value)} placeholder="0x080491e2" className="bg-black/60 border border-white/20 p-2 text-sm font-mono text-white focus:outline-none" />
                                    </div>
                                </div>
                                <PixelButton variant="retro" onClick={handleCalcOffset}>📐 CALCULATE</PixelButton>
                                {addrCalcResult && <div className="p-3 bg-black/40 border border-white/10 text-sm font-mono text-neon-green">{addrCalcResult}</div>}
                            </>
                        )}

                        {tool === 'packing' && (
                            <>
                                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter address (0xdeadbeef)..." className="bg-black/60 border border-white/20 p-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none" />
                                <PixelButton variant="retro" onClick={handlePack}>📦 PACK</PixelButton>
                                {(packResult.le || packResult.be) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="p-3 bg-black/40 border border-white/10">
                                            <div className="text-[10px] text-gray-500 mb-1">Little Endian (x86/x64)</div>
                                            <div className="text-sm font-mono text-neon-green">{packResult.le}</div>
                                        </div>
                                        <div className="p-3 bg-black/40 border border-white/10">
                                            <div className="text-[10px] text-gray-500 mb-1">Big Endian</div>
                                            <div className="text-sm font-mono text-cyber-pink">{packResult.be}</div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </PixelCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        { title: 'Cyclic Pattern', desc: 'Generate unique patterns to find exact crash offset by checking EIP/RIP value.' },
                        { title: 'Address Packing', desc: 'Convert addresses to byte strings for exploit payloads. Remember endianness!' },
                    ].map(i => (
                        <div key={i.title} className="p-3 bg-pixel-gray/50 border-l-4 border-retro-yellow">
                            <h3 className="text-xs font-bold text-white">{i.title}</h3>
                            <p className="text-[9px] text-gray-400 mt-1">{i.desc}</p>
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
