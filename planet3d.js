// ─── 3D INTERACTIVE FLAME PLANET GLOBE (WITH AUTOMATIC FALLBACK) ───
(function() {
    function isWebGLSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    function init3DPlanet() {
        const container = document.getElementById('planet-3d-container');
        if (!container) return;

        // Check WebGL and Three.js availability — if missing, keep classic CSS orb fallback
        if (typeof THREE === 'undefined' || !isWebGLSupported()) {
            console.warn('[CrimsonFlame] WebGL or Three.js unavailable. Using classic CSS orb fallback.');
            return;
        }

        let renderer;
        try {
            const width = container.clientWidth || 360;
            const height = container.clientHeight || 360;

            // 1. Scene, Camera, Renderer
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
            camera.position.set(0, 0, width < 360 ? 480 : 440);

            renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.domElement.style.position = 'absolute';
            renderer.domElement.style.top = '0';
            renderer.domElement.style.left = '0';
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.pointerEvents = 'auto';
            renderer.domElement.style.cursor = 'grab';
            renderer.domElement.style.touchAction = 'pan-y';

            // Hide static CSS orb & CSS rings only after successful 3D WebGL renderer creation
            const staticElements = container.querySelectorAll('.orb, .orb-ring');
            staticElements.forEach(function(el) { el.style.display = 'none'; });

            container.appendChild(renderer.domElement);

            // 2. Theme Palettes for 3D Planet Globe
            const THEME_PALETTES = {
                'crimson': {
                    emissive: 0x7a0d0d,
                    atmos: 0xff3b3b,
                    aura: 0xff7722,
                    ring1: 0xff4d4d,
                    ring2: 0xff9933,
                    particles: 0xff6b35,
                    lightPoint: 0xff4500,
                    lightBack: 0xdc2626,
                    lightAmbient: 0x2a080c,
                    baseColor: '#0a0305',
                    spot1: 'rgba(255, 140, 0, 0.9)',
                    spot2: 'rgba(220, 38, 38, 0.5)',
                    veinR: 205, veinG: 0, veinB: 0,
                    multR: 50, multG: 160, multB: 35
                },
                'emerald': {
                    emissive: 0x064e3b,
                    atmos: 0x10b981,
                    aura: 0x34d399,
                    ring1: 0x34d399,
                    ring2: 0x6ee7b7,
                    particles: 0x10b981,
                    lightPoint: 0x10b981,
                    lightBack: 0x059669,
                    lightAmbient: 0x042416,
                    baseColor: '#020f08',
                    spot1: 'rgba(52, 211, 153, 0.9)',
                    spot2: 'rgba(16, 185, 129, 0.5)',
                    veinR: 16, veinG: 185, veinB: 129,
                    multR: 36, multG: 70, multB: 40
                },
                'void': {
                    emissive: 0x4c1d95,
                    atmos: 0x8b5cf6,
                    aura: 0xa855f7,
                    ring1: 0xa78bfa,
                    ring2: 0xd8b4fe,
                    particles: 0xa855f7,
                    lightPoint: 0xa855f7,
                    lightBack: 0x7c3aed,
                    lightAmbient: 0x1a0933,
                    baseColor: '#090414',
                    spot1: 'rgba(192, 132, 252, 0.9)',
                    spot2: 'rgba(139, 92, 246, 0.5)',
                    veinR: 139, veinG: 92, veinB: 246,
                    multR: 70, multG: 40, multB: 10
                },
                'solar': {
                    emissive: 0x78350f,
                    atmos: 0xf59e0b,
                    aura: 0xfbbf24,
                    ring1: 0xfbbf24,
                    ring2: 0xfde68a,
                    particles: 0xf59e0b,
                    lightPoint: 0xfbbf24,
                    lightBack: 0xd97706,
                    lightAmbient: 0x2b1704,
                    baseColor: '#120b02',
                    spot1: 'rgba(251, 191, 36, 0.9)',
                    spot2: 'rgba(245, 158, 11, 0.5)',
                    veinR: 245, veinG: 158, veinB: 11,
                    multR: 10, multG: 80, multB: 25
                },
                'glacier': {
                    emissive: 0x0c4a6e,
                    atmos: 0x06b6d4,
                    aura: 0x38bdf8,
                    ring1: 0x38bdf8,
                    ring2: 0x7dd3fc,
                    particles: 0x38bdf8,
                    lightPoint: 0x38bdf8,
                    lightBack: 0x0284c7,
                    lightAmbient: 0x041c2c,
                    baseColor: '#020b12',
                    spot1: 'rgba(56, 189, 248, 0.9)',
                    spot2: 'rgba(6, 182, 212, 0.5)',
                    veinR: 6, veinG: 182, veinB: 212,
                    multR: 50, multG: 60, multB: 43
                },
                'frutiger-aero': {
                    emissive: 0x0369a1,
                    atmos: 0x38bdf8,
                    aura: 0x34d399,
                    ring1: 0x38bdf8,
                    ring2: 0x34d399,
                    particles: 0x38bdf8,
                    lightPoint: 0x38bdf8,
                    lightBack: 0x10b981,
                    lightAmbient: 0x032030,
                    baseColor: '#03141f',
                    spot1: 'rgba(56, 189, 248, 0.95)',
                    spot2: 'rgba(16, 185, 129, 0.5)',
                    veinR: 2, veinG: 132, veinB: 199,
                    multR: 54, multG: 80, multB: 49
                },
                'frutiger-metro': {
                    emissive: 0x004578,
                    atmos: 0x00a4ef,
                    aura: 0xd80073,
                    ring1: 0x0078d7,
                    ring2: 0xd80073,
                    particles: 0x00a4ef,
                    lightPoint: 0x00a4ef,
                    lightBack: 0xd80073,
                    lightAmbient: 0x021528,
                    baseColor: '#040810',
                    spot1: 'rgba(0, 164, 239, 0.95)',
                    spot2: 'rgba(216, 0, 115, 0.6)',
                    veinR: 0, veinG: 120, veinB: 215,
                    multR: 0, multG: 44, multB: 40
                }
            };

            const currentPalette = THEME_PALETTES['crimson'];

            // Procedural Theme-Aware Canvas Texture Generator
            function generateLavaTexture(palette) {
                const pal = palette || currentPalette;
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');

                // Basalt / Matrix Crust Base
                ctx.fillStyle = pal.baseColor || '#0a0305';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Generate Fluid Veins & Hotspots
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;

                const twoPi = Math.PI * 2;
                const xCycles = 3;

                for (let y = 0; y < canvas.height; y++) {
                    const ny = (y / canvas.height) * Math.PI;
                    const cosNy15 = Math.cos(ny * 3.0);
                    const cosNy20 = Math.cos(ny * 4.0);
                    const sinNy30 = Math.sin(ny * 6.0);

                    for (let x = 0; x < canvas.width; x++) {
                        const idx = (y * canvas.width + x) * 4;
                        const nx = (x / canvas.width) * twoPi * xCycles;

                        const v1 = Math.sin(nx + cosNy15) * cosNy20;
                        const v2 = Math.sin(nx * 2.5 - sinNy30);
                        const n = (v1 + v2 + 2) / 4;

                        if (n > 0.45) {
                            const intensity = (n - 0.45) / 0.55;
                            data[idx]     = Math.min(255, pal.veinR + intensity * pal.multR);
                            data[idx + 1] = Math.min(255, pal.veinG + intensity * pal.multG);
                            data[idx + 2] = Math.min(255, pal.veinB + intensity * pal.multB);
                        } else {
                            const crust = Math.floor(n * 40);
                            data[idx]     = crust + 12;
                            data[idx + 1] = crust + 8;
                            data[idx + 2] = crust + 14;
                        }
                        data[idx + 3] = 255;
                    }
                }
                ctx.putImageData(imgData, 0, 0);

                // Add glowing hotspot patches (seamlessly wrapped)
                for (let i = 0; i < 36; i++) {
                    const cx = Math.random() * canvas.width;
                    const cy = Math.random() * canvas.height;
                    const rad = Math.random() * 40 + 12;

                    function drawSpot(px, py) {
                        const grad = ctx.createRadialGradient(px, py, 0, px, py, rad);
                        grad.addColorStop(0, pal.spot1);
                        grad.addColorStop(0.5, pal.spot2);
                        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(px, py, rad, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    drawSpot(cx, cy);
                    if (cx - rad < 0) drawSpot(cx + canvas.width, cy);
                    if (cx + rad > canvas.width) drawSpot(cx - canvas.width, cy);
                }

                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                return texture;
            }

            const lavaTexture = generateLavaTexture(currentPalette);

            // 3. Planet Mesh (Smooth Sphere with molten glow and obsidian plates)
            const planetRadius = 96;
            const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 64);
            const planetMat = new THREE.MeshStandardMaterial({
                map: lavaTexture,
                roughness: 0.58,
                metalness: 0.18,
                emissive: new THREE.Color(currentPalette.emissive),
                emissiveIntensity: 0.65,
                emissiveMap: lavaTexture
            });
            const planetMesh = new THREE.Mesh(planetGeo, planetMat);
            scene.add(planetMesh);

            // 4. Glowing Atmosphere Shell (Fresnel Rim Haze)
            const atmosGeo = new THREE.SphereGeometry(planetRadius * 1.055, 48, 48);
            const atmosMat = new THREE.MeshBasicMaterial({
                color: 0xff3b3b,
                transparent: true,
                opacity: 0.26,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            });
            const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
            scene.add(atmosMesh);

            // Subtle secondary inner aura
            const innerAuraGeo = new THREE.SphereGeometry(planetRadius * 1.018, 48, 48);
            const innerAuraMat = new THREE.MeshBasicMaterial({
                color: 0xff7722,
                transparent: true,
                opacity: 0.15,
                blending: THREE.AdditiveBlending
            });
            scene.add(new THREE.Mesh(innerAuraGeo, innerAuraMat));

            // 5. 3D Orbital Rings (Torus rings scaled to match enlarged planet)
            const ringGroup = new THREE.Group();

            const ring1Geo = new THREE.TorusGeometry(135, 2.2, 16, 100);
            const ring1Mat = new THREE.MeshBasicMaterial({
                color: 0xff4d4d,
                transparent: true,
                opacity: 0.65,
                blending: THREE.AdditiveBlending
            });
            const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
            ring1.rotation.x = Math.PI / 2.4;
            ring1.rotation.y = Math.PI / 8;
            ringGroup.add(ring1);

            const ring2Geo = new THREE.TorusGeometry(165, 1.4, 16, 100);
            const ring2Mat = new THREE.MeshBasicMaterial({
                color: 0xff9933,
                transparent: true,
                opacity: 0.45,
                blending: THREE.AdditiveBlending
            });
            const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
            ring2.rotation.x = Math.PI / 1.8;
            ring2.rotation.y = -Math.PI / 6;
            ringGroup.add(ring2);

            scene.add(ringGroup);

            // 6. 3D Floating Embers Particle Swarm
            const particleCount = 140;
            const particleGeo = new THREE.BufferGeometry();
            const particlePositions = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                const r = planetRadius + 18 + Math.random() * 65;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI - Math.PI / 2;

                particlePositions[i * 3]     = r * Math.cos(phi) * Math.cos(theta);
                particlePositions[i * 3 + 1] = r * Math.sin(phi);
                particlePositions[i * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);
            }

            particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

            const particleMat = new THREE.PointsMaterial({
                color: 0xff6b35,
                size: 3,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });

            const particleSystem = new THREE.Points(particleGeo, particleMat);
            scene.add(particleSystem);

            // 7. Lighting (Cinema-Grade Fiery Core & Rim Glow)
            const ambientLight = new THREE.AmbientLight(0x2a080c, 1.3);
            scene.add(ambientLight);

            const pointLight = new THREE.PointLight(0xff4500, 2.6, 600);
            pointLight.position.set(130, 110, 160);
            scene.add(pointLight);

            const backLight = new THREE.PointLight(0xdc2626, 1.6, 500);
            backLight.position.set(-160, -100, -130);
            scene.add(backLight);

            // 8. Interactivity & Damping Controls
            let isDragging = false;
            let previousMousePosition = { x: 0, y: 0 };
            let targetRotationX = 0;
            let targetRotationY = 0;
            let currentRotationX = 0;
            let currentRotationY = 0;

            const domEl = renderer.domElement;

            domEl.addEventListener('mousedown', function(e) {
                isDragging = true;
                domEl.style.cursor = 'grabbing';
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });

            window.addEventListener('mouseup', function() {
                isDragging = false;
                domEl.style.cursor = 'grab';
            });

            window.addEventListener('mousemove', function(e) {
                if (isDragging) {
                    const deltaX = e.clientX - previousMousePosition.x;
                    const deltaY = e.clientY - previousMousePosition.y;

                    targetRotationY += deltaX * 0.008;
                    targetRotationX += deltaY * 0.008;

                    previousMousePosition = { x: e.clientX, y: e.clientY };
                } else {
                    const normX = (e.clientX / window.innerWidth - 0.5) * 2;
                    const normY = (e.clientY / window.innerHeight - 0.5) * 2;
                    targetRotationY = normX * 0.4;
                    targetRotationX = normY * 0.4;
                }
            });

            // Touch Support
            domEl.addEventListener('touchstart', function(e) {
                if (e.touches.length === 1) {
                    isDragging = true;
                    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            }, { passive: true });

            window.addEventListener('touchmove', function(e) {
                if (isDragging && e.touches.length === 1) {
                    const deltaX = e.touches[0].clientX - previousMousePosition.x;
                    const deltaY = e.touches[0].clientY - previousMousePosition.y;

                    targetRotationY += deltaX * 0.008;
                    targetRotationX += deltaY * 0.008;

                    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            }, { passive: true });

            window.addEventListener('touchend', function() {
                isDragging = false;
            });

            // 9. Resize Listener
            function onWindowResize() {
                const newW = container.clientWidth || 360;
                const newH = container.clientHeight || 360;
                camera.aspect = newW / newH;
                camera.position.z = newW < 360 ? 480 : 440;
                camera.updateProjectionMatrix();
                renderer.setSize(newW, newH);
            }
            window.addEventListener('resize', onWindowResize);

            // 10. Animation Loop
            let clock = new THREE.Clock();

            function animate() {
                requestAnimationFrame(animate);

                const elapsedTime = clock.getElapsedTime();

                planetMesh.rotation.y += 0.004;

                ring1.rotation.z = elapsedTime * 0.15;
                ring2.rotation.z = -elapsedTime * 0.22;

                particleSystem.rotation.y = elapsedTime * 0.08;
                particleSystem.rotation.x = Math.sin(elapsedTime * 0.1) * 0.1;

                currentRotationX += (targetRotationX - currentRotationX) * 0.06;
                currentRotationY += (targetRotationY - currentRotationY) * 0.06;

                scene.rotation.x = currentRotationX;
                scene.rotation.y = currentRotationY;

                renderer.render(scene, camera);
            }

            // Dynamic Theme Application Engine for 3D Planet
            function applyPlanetTheme(themeName) {
                const palette = THEME_PALETTES[themeName] || THEME_PALETTES['crimson'];
                const newTexture = generateLavaTexture(palette);
                planetMat.map = newTexture;
                planetMat.emissiveMap = newTexture;
                planetMat.emissive.setHex(palette.emissive);
                planetMat.needsUpdate = true;

                atmosMat.color.setHex(palette.atmos);
                innerAuraMat.color.setHex(palette.aura);
                ring1Mat.color.setHex(palette.ring1);
                ring2Mat.color.setHex(palette.ring2);
                particleMat.color.setHex(palette.particles);
                pointLight.color.setHex(palette.lightPoint);
                backLight.color.setHex(palette.lightBack);
                ambientLight.color.setHex(palette.lightAmbient);
            }

            animate();

        } catch (err) {
            console.warn('[CrimsonFlame] WebGL initialization failed. Falling back to classic CSS orb:', err);
            const staticElements = container.querySelectorAll('.orb, .orb-ring');
            staticElements.forEach(function(el) { el.style.display = 'block'; });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init3DPlanet);
    } else {
        init3DPlanet();
    }
})();
