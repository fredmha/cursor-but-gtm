
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { generateChannelsAndBets } from '../services/geminiService';
import { Campaign, OperatingPrinciple } from '../types';

export const useOnboarding = () => {
  const { setCampaign, updateCampaign, importAIPlan, campaign, addChannel } = useStore();
  
  // --- Core State ---
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<{
    quarter: string;
    objective: string;
    startDate: string;
    endDate: string;
    principles: OperatingPrinciple[];
  }>({
    quarter: campaign?.name || '',
    objective: campaign?.objective || '',
    startDate: campaign?.startDate || new Date().toISOString().split('T')[0],
    endDate: campaign?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
    principles: campaign?.principles || []
  });

  // --- Canvas/Whiteboard State ---
  const [buckets, setBuckets] = useState<string[]>(['ACQUISITION', 'CUSTOMER', 'CULTURE']);
  const [editingBucket, setEditingBucket] = useState<string | null>(null);
  const [tempBucketName, setTempBucketName] = useState('');
  const [draggedPrincipleId, setDraggedPrincipleId] = useState<string | null>(null);

  // --- Synchronization ---
  useEffect(() => {
    if (campaign) {
      setFormData(prev => ({
        ...prev,
        quarter: campaign.name,
        objective: campaign.objective,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        principles: campaign.principles || []
      }));
      
      if (campaign.principles && campaign.principles.length > 0) {
        const cats = Array.from(new Set(campaign.principles.map(p => p.category))).filter(Boolean);
        if (cats.length > 0) {
          setBuckets(prev => Array.from(new Set([...prev, ...cats])));
        }
      }
    }
  }, [campaign]);

  // --- Actions ---

  const updateStore = (status: 'Onboarding' | 'Planning') => {
    const c: Campaign = {
      id: campaign?.id || crypto.randomUUID(),
      name: formData.quarter,
      objective: formData.objective,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: status,
      channels: campaign?.channels || [],
      principles: formData.principles,
      projects: campaign?.projects || [],
      roadmapItems: campaign?.roadmapItems || []
    };
    if (campaign) {
      updateCampaign(c);
    } else {
      setCampaign(c);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!formData.quarter || !formData.objective) return;
      updateStore('Onboarding');
      setStep(2);
    } else if (step === 2) {
       updateStore('Onboarding');
       // Initialize some default channels if empty
       if (!campaign?.channels || campaign.channels.length === 0) {
           addChannel({ id: crypto.randomUUID(), name: 'THEMES', campaignId: campaign?.id || '', bets: [], principles: [] });
           addChannel({ id: crypto.randomUUID(), name: 'LAUNCHES', campaignId: campaign?.id || '', bets: [], principles: [] });
           addChannel({ id: crypto.randomUUID(), name: 'LINKEDIN', campaignId: campaign?.id || '', bets: [], principles: [] });
       }
       setStep(3); // Go to Roadmap Sandbox
    } else if (step === 3) {
       updateStore('Onboarding');
       setStep(4); // Go to AI Strategy
    } else if (step === 4) {
      setLoading(true);
      const result = await generateChannelsAndBets(formData.objective);
      if (result && result.channels) {
        importAIPlan(result.channels);
      }
      setLoading(false);
      setStep(5); // Summary
    } else {
      updateStore('Planning');
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // --- Principle Logic ---

  const addPrinciple = (category: string) => {
    const p: OperatingPrinciple = {
      id: crypto.randomUUID(),
      title: '', 
      description: '',
      category: category
    };
    setFormData(prev => ({ ...prev, principles: [...prev.principles, p] }));
  };

  const updatePrinciple = (id: string, updates: Partial<OperatingPrinciple>) => {
    setFormData(prev => ({
      ...prev,
      principles: prev.principles.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const removePrinciple = (id: string) => {
    setFormData(prev => ({ ...prev, principles: prev.principles.filter(p => p.id !== id) }));
  };

  // --- Bucket Logic ---

  const addBucket = () => {
    let base = 'GROUP';
    let name = base;
    let i = 1;
    while (buckets.includes(name)) {
      name = `${base} ${i}`;
      i++;
    }
    setBuckets(prev => [...prev, name]);
    setEditingBucket(name);
    setTempBucketName(name);
  };

  const renameBucket = (oldName: string) => {
    const newName = tempBucketName.toUpperCase().trim();
    if (!newName) {
         setEditingBucket(null);
         return;
    }

    if (newName !== oldName) {
        if (buckets.includes(newName)) {
            setEditingBucket(null);
            return;
        }

        setBuckets(prev => prev.map(b => b === oldName ? newName : b));
        setFormData(prev => ({
            ...prev,
            principles: prev.principles.map(p => p.category === oldName ? { ...p, category: newName } : p)
        }));
    }
    setEditingBucket(null);
  };
  
  const deleteBucket = (bucket: string) => {
      // NOTE: Logic separated for easier testing/debugging
      if (confirm(`Delete group "${bucket}" and its cards?`)) {
          setBuckets(prev => prev.filter(b => b !== bucket));
          setFormData(prev => ({
              ...prev,
              principles: prev.principles.filter(p => p.category !== bucket)
          }));
      }
  };

  // --- Drag and Drop ---

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedPrincipleId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id); 
  };

  const handleDrop = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (draggedPrincipleId) {
      updatePrinciple(draggedPrincipleId, { category: targetCategory });
      setDraggedPrincipleId(null);
    }
  };

  // --- Computed Data ---
  const principlesByCategory = useMemo(() => {
    const grouped: Record<string, OperatingPrinciple[]> = {};
    buckets.forEach(b => grouped[b] = []);
    
    formData.principles.forEach(p => {
      const cat = p.category || 'GENERAL';
      if (!grouped[cat]) {
        grouped[cat] = [];
        if (!buckets.includes(cat)) { 
             // Should ideally sync state here, but for now rely on buckets state
        }
      }
      grouped[cat].push(p);
    });
    return grouped;
  }, [formData.principles, buckets]);

  return {
    state: {
      step,
      loading,
      formData,
      buckets,
      editingBucket,
      tempBucketName,
      principlesByCategory,
      campaign
    },
    actions: {
      setStep,
      setFormData,
      handleNext,
      handleBack,
      addPrinciple,
      updatePrinciple,
      removePrinciple,
      addBucket,
      renameBucket,
      deleteBucket,
      setEditingBucket,
      setTempBucketName,
      handleDragStart,
      handleDrop
    }
  };
};
