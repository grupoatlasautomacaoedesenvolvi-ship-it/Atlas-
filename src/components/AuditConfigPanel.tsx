import React, { useState } from 'react';
import { AuditConfig, AuditRuleConfig } from '../types';
import { Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface AuditConfigPanelProps {
  config: AuditConfig | null;
  onSave: (config: AuditConfig) => void;
}

export function AuditConfigPanel({ config, onSave }: AuditConfigPanelProps) {
  const [rules, setRules] = useState<AuditRuleConfig[]>(config?.rules || [
    {
      id: 'fuel_ncm',
      name: 'Combustível por NCM',
      uf: 'ALL',
      ncm: '2710',
      expectedCfops: ['1653', '2653', '1662', '2662'],
      expectedCsts: [],
      errorMessage: 'Combustível classificado com CFOP incorreto para consumo/uso.'
    }
  ]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    onSave({ rules });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const addRule = () => {
    setRules([...rules, {
      id: Date.now().toString(),
      name: 'Nova Regra por NCM',
      uf: 'ALL',
      ncm: '',
      expectedCfops: [],
      expectedCsts: [],
      errorMessage: 'Divergência tributária detectada para o NCM.'
    }]);
  };

  const updateRule = (id: string, field: keyof AuditRuleConfig, value: string) => {
    setRules(rules.map(r => {
      if (r.id === id) {
        if (field === 'expectedCfops' || field === 'expectedCsts') {
          return { ...r, [field]: value.split(',').map(s => s.trim()).filter(s => s) };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Regras de Auditoria por NCM & UF</h2>
            <p className="text-sm text-slate-500">Defina CFOPs e CSTs esperados por NCM e estado de destino (UF) sem necessidade de login</p>
          </div>
          <div className="flex items-center space-x-3">
            {savedSuccess && (
              <span className="inline-flex items-center space-x-1 text-emerald-700 text-sm font-medium animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Alterações salvas</span>
              </span>
            )}
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 bg-[#1e3a5f] text-white px-5 py-2.5 rounded-lg hover:bg-[#142c47] transition-colors text-sm font-medium shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Regras</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {rules.map((rule) => (
            <div key={rule.id} className="border border-slate-200 rounded-lg p-5 bg-slate-50/60 relative shadow-xs">
              <button
                onClick={() => removeRule(rule.id)}
                className="absolute top-5 right-5 text-slate-400 hover:text-red-500 transition-colors p-2 bg-white rounded-md border border-slate-200 hover:border-red-200"
                title="Excluir regra"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-12">
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nome da Regra</label>
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Ex: Combustível NCM 2710"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NCM (Prefixo ou Completo)</label>
                  <input
                    type="text"
                    value={rule.ncm}
                    onChange={(e) => updateRule(rule.id, 'ncm', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Ex: 2710"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">UF Destino (ou ALL)</label>
                  <input
                    type="text"
                    value={rule.uf}
                    onChange={(e) => updateRule(rule.id, 'uf', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Ex: SP, RJ, ou ALL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">CFOPs Esperados (separados por vírgula)</label>
                  <input
                    type="text"
                    value={rule.expectedCfops.join(', ')}
                    onChange={(e) => updateRule(rule.id, 'expectedCfops', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Ex: 1653, 2653"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">CSTs Esperados (opcional)</label>
                  <input
                    type="text"
                    value={rule.expectedCsts.join(', ')}
                    onChange={(e) => updateRule(rule.id, 'expectedCsts', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Ex: 060, 090"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mensagem de Erro</label>
                  <input
                    type="text"
                    value={rule.errorMessage}
                    onChange={(e) => updateRule(rule.id, 'errorMessage', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addRule}
            className="w-full flex items-center justify-center space-x-2 border-2 border-dashed border-slate-300 text-slate-600 py-3.5 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-colors text-sm font-medium bg-white"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Nova Regra por NCM & UF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
