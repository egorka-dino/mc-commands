import com.google.gson.*;
import net.minecraft.client.model.Model;
import net.minecraft.client.model.geom.*;
import net.minecraft.client.renderer.*;
import net.minecraft.client.renderer.entity.*;
import net.minecraft.client.renderer.entity.state.*;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.client.renderer.rendertype.RenderType;
import com.mojang.blaze3d.vertex.*;
import net.minecraft.resources.Identifier;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/** CPU capture of actual vanilla renderer submissions. No GPU, window, or rasterizer. */
public class CaptureScenes {
 static final Gson GSON=new GsonBuilder().disableHtmlEscaping().create();
 static JsonElement canonical(JsonElement value){
  if(value.isJsonObject()){var object=new JsonObject();var entries=new TreeMap<String,JsonElement>();value.getAsJsonObject().entrySet().forEach(e->entries.put(e.getKey(),e.getValue()));entries.forEach((k,v)->object.add(k,canonical(v)));return object;}
  if(value.isJsonArray()){var array=new JsonArray();value.getAsJsonArray().forEach(v->array.add(canonical(v)));return array;}return value;
 }
 static String encode(Object value){return GSON.toJson(canonical(GSON.toJsonTree(value)));}
 static PartPose elytraRest;
 static VanillaAssets assets;
 static Capture active; static Path output; static Set<String> textures=new TreeSet<>(); static Set<String> written=new HashSet<>();
 static Object unsafe; static Method allocate; static JsonObject defaults;
 static Object get(Object o,String name)throws Exception {Class<?> c=o instanceof Class<?>?(Class<?>)o:o.getClass();while(c!=null){try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f.get(o instanceof Class<?>?null:o);}catch(NoSuchFieldException ex){c=c.getSuperclass();}}throw new NoSuchFieldException(name);}
 static void set(Object o,String name,Object value)throws Exception {Class<?> c=o.getClass();while(c!=null){try{Field f=c.getDeclaredField(name);f.setAccessible(true);f.set(o,value);return;}catch(NoSuchFieldException ex){c=c.getSuperclass();}}}
 static String texture(RenderType type)throws Exception {var state=get(type,"state");var map=(Map<?,?>)get(state,"textures");var binding=map.get("Sampler0");return binding==null?null:String.valueOf(get(binding,"location"));}
 static class Vertices implements VertexConsumer {
  List<float[]> vertices=new ArrayList<>(); float[] current;
  public VertexConsumer addVertex(float x,float y,float z){current=new float[]{x,y,z,0,0,0,1,0,1,1,1,1};vertices.add(current);return this;}
  public VertexConsumer setColor(int r,int g,int b,int a){current[8]=r/255f;current[9]=g/255f;current[10]=b/255f;current[11]=a/255f;return this;}
  public VertexConsumer setColor(int color){return setColor(color>>16&255,color>>8&255,color&255,color>>>24);}
  public VertexConsumer setUv(float u,float v){current[3]=u;current[4]=v;return this;}
  public VertexConsumer setNormal(float x,float y,float z){current[5]=x;current[6]=y;current[7]=z;return this;}
  public VertexConsumer setUv1(int u,int v){return this;} public VertexConsumer setUv2(int u,int v){return this;} public VertexConsumer setLineWidth(float w){return this;}
 }
 static String spriteTexture(Object[] args){for(Object arg:args)if(arg instanceof net.minecraft.client.renderer.texture.TextureAtlasSprite sprite)return "minecraft:textures/"+sprite.contents().name().getPath()+".png";return null;}
 static class Capture implements InvocationHandler {
  List<Object> meshes=new ArrayList<>(); List<String> unsupported=new ArrayList<>(); Map<String,Object> attachments=new TreeMap<>(); boolean quads=false; Map<String,List<float[]>> quadGroups=new HashMap<>();
  SubmitNodeCollector proxy=(SubmitNodeCollector)Proxy.newProxyInstance(CaptureScenes.class.getClassLoader(),new Class[]{SubmitNodeCollector.class},this);
  void add(Vertices v,RenderType type)throws Exception{add(v,type,null);}
  void add(Vertices v,RenderType type,String override)throws Exception{if(v.vertices.isEmpty() || type.toString().contains("water_mask"))return;String tex=override!=null?override:texture(type);Map<String,Object> m=new LinkedHashMap<>();m.put("vertices",v.vertices);if(tex!=null){m.put("texture",tex);textures.add(tex);}m.put("pipeline",type.toString().split(":")[0]);if(quads){String key=tex+"/"+m.get("pipeline");if(quadGroups.containsKey(key)){quadGroups.get(key).addAll(v.vertices);return;}quadGroups.put(key,v.vertices);}meshes.add(m);}
  public Object invoke(Object p,Method method,Object[] args)throws Throwable {
   String n=method.getName();if(n.equals("order"))return p;
   if(method.isDefault())return InvocationHandler.invokeDefault(p,method,args);
   if(n.equals("submitModel")){
    Model model=(Model)args[0];model.setupAnim(args[1]);var v=new Vertices();model.renderToBuffer((PoseStack)args[2],v,15728880,655360,args.length>=10?(Integer)args[6]:-1);add(v,(RenderType)args[3],spriteTexture(args));return null;
   }
   if(n.equals("submitModelPart")){var v=new Vertices();((ModelPart)args[0]).render((PoseStack)args[1],v,15728880,655360,(Integer)args[8]);add(v,(RenderType)args[2],spriteTexture(args));return null;}
   if(n.equals("submitCustomGeometry")){var v=new Vertices();((SubmitNodeCollector.CustomGeometryRenderer)args[2]).render(((PoseStack)args[0]).last(),v);add(v,(RenderType)args[1]);return null;}
   if(n.equals("submitBlockModel")) {quads=true;
    int[] tints=(int[])args[3];
    for(var part:(List<net.minecraft.client.renderer.block.dispatch.BlockStateModelPart>)args[2])for(int direction=-1;direction<6;direction++)for(var quad:part.getQuads(direction<0?null:net.minecraft.core.Direction.values()[direction])) {
     var instance=new QuadInstance();var mat=quad.materialInfo();instance.setColor(mat.isTinted()&&mat.tintIndex()<tints.length?tints[mat.tintIndex()]:-1);instance.setLightCoords(15728880);var vertices=new Vertices();vertices.putBakedQuad(((PoseStack)args[0]).last(),quad,instance);add(vertices,mat.itemRenderType(),"minecraft:textures/"+mat.sprite().contents().name().getPath()+".png");
    }quads=false;return null;
   }
   if(n.equals("submitItem")) {quads=true;
    var pose=((PoseStack)args[0]).last();int[] tints=(int[])args[5];
    for(var quad:(List<net.minecraft.client.resources.model.geometry.BakedQuad>)args[6]){
     var instance=new QuadInstance();var mat=quad.materialInfo();instance.setColor(mat.isTinted()&&mat.tintIndex()<tints.length?tints[mat.tintIndex()]:-1);instance.setLightCoords(15728880);
     var vertices=new Vertices();vertices.putBakedQuad(pose,quad,instance);add(vertices,mat.itemRenderType(),"minecraft:textures/"+mat.sprite().contents().name().getPath()+".png");
    }quads=false;return null;
   }
   if(n.equals("submitShadow")||n.equals("submitNameTag")||n.equals("submitLeash"))return null;
   unsupported.add(n);return null;
  }
 }
 static Object defaultValue(Class<?> c,String tex,int depth)throws Exception {
  if(depth>5)return null;if(c.isEnum())return c.getEnumConstants()[0];
  if(c==Identifier.class)return Identifier.withDefaultNamespace(tex);
  if(c==Optional.class)return Optional.empty();if(c==List.class)return List.of();
  if(c==boolean.class)return false;if(c==float.class)return 0f;if(c==double.class)return 0d;if(c==long.class)return 0L;if(c==int.class)return 0;
  if(c.isRecord()) {var fields=c.getRecordComponents();var types=Arrays.stream(fields).map(RecordComponent::getType).toArray(Class[]::new);var values=new Object[fields.length];for(int i=0;i<fields.length;i++)values[i]=defaultValue(types[i],tex,depth+1);return c.getConstructor(types).newInstance(values);}
  for(Field f:c.getFields())if(Modifier.isStatic(f.getModifiers())&&f.getType()==c&&(f.getName().equals("EMPTY")||f.getName().equals("DEFAULT")))return f.get(null);
  return null;
 }
 static EntityRenderState state(EntityRenderer renderer,EntityType type,String id,boolean baby)throws Exception {
  var s=renderer.createRenderState();s.entityType=type;s.lightCoords=15728880;s.boundingBoxWidth=type.getDimensions().width();s.boundingBoxHeight=type.getDimensions().height();
  if(s instanceof LivingEntityRenderState l){l.scale=1;l.ageScale=baby?.5f:1;l.isBaby=baby;l.pose=Pose.STANDING;}
  String tex=defaults.has(id)?defaults.get(id).getAsString():"entity/"+id+"/"+id;
  for(Field f:s.getClass().getFields()){
   if(Modifier.isFinal(f.getModifiers())||Modifier.isStatic(f.getModifiers())||f.getType()==net.minecraft.world.item.DyeColor.class)continue;
   if(!f.getType().isPrimitive()&&f.get(s)==null&&(f.getType().isEnum()||f.getType().isRecord()||f.getType()==Identifier.class)){
    try{Object v;
      if(f.getType().getName().matches(".*(CowVariant|PigVariant|ChickenVariant)")) {
       var c=f.getType();var modelType=Class.forName(c.getName()+"$ModelType");Object variant=modelType.getEnumConstants()[0];for(Object candidate:modelType.getEnumConstants())if(candidate.toString().equalsIgnoreCase("normal"))variant=candidate;
       var mt=new net.minecraft.world.entity.variant.ModelAndTexture(variant,Identifier.withDefaultNamespace(tex));
       v=c.getConstructors()[0].newInstance(mt,new net.minecraft.core.ClientAsset.ResourceTexture(Identifier.withDefaultNamespace(tex+"_baby")),net.minecraft.world.entity.variant.SpawnPrioritySelectors.EMPTY);
      } else v=defaultValue(f.getType(),tex,0);if(v!=null)f.set(s,v);}catch(Exception ex){}
   }
  }
  if(s instanceof SlimeRenderState slime)slime.size=1;
  if(s instanceof GoatRenderState goat){goat.hasLeftHorn=true;goat.hasRightHorn=true;}
  if(s instanceof TntRenderState tnt)tnt.fuseRemainingInTicks=((Number)get(net.minecraft.world.entity.item.PrimedTnt.class,"DEFAULT_FUSE_TIME")).floatValue();
  if(s instanceof WolfRenderState wolf)wolf.wetShade=1;
  if(s instanceof HumanoidRenderState h){h.speedValue=1;h.elytraRotX=elytraRest.xRot();h.elytraRotY=elytraRest.yRot();h.elytraRotZ=elytraRest.zRot();}
  if(s instanceof IllagerRenderState illager && !id.equals("pillager"))illager.armPose=net.minecraft.world.entity.monster.illager.AbstractIllager.IllagerArmPose.CROSSED;
  if(s instanceof ArmorStandRenderState stand){stand.showBasePlate=true;stand.wiggle=10;}
  if(s instanceof net.minecraft.client.renderer.entity.state.ItemFrameRenderState frame)frame.mapId=null;
  if(s instanceof net.minecraft.client.renderer.entity.state.VillagerRenderState villager)villager.villagerData=new net.minecraft.world.entity.npc.villager.VillagerData(BuiltInRegistries.VILLAGER_TYPE.getOrThrow(net.minecraft.world.entity.npc.villager.VillagerType.PLAINS),BuiltInRegistries.VILLAGER_PROFESSION.getOrThrow(net.minecraft.world.entity.npc.villager.VillagerProfession.NONE),1);
  for(Field f:s.getClass().getFields())if(f.getType()==net.minecraft.world.entity.npc.villager.VillagerData.class)f.set(s,new net.minecraft.world.entity.npc.villager.VillagerData(BuiltInRegistries.VILLAGER_TYPE.getOrThrow(net.minecraft.world.entity.npc.villager.VillagerType.PLAINS),BuiltInRegistries.VILLAGER_PROFESSION.getOrThrow(net.minecraft.world.entity.npc.villager.VillagerProfession.NONE),1));
  if(assets!=null) {
   if(s instanceof TntRenderState tnt)assets.blocks.update(tnt.blockState,net.minecraft.world.level.block.Blocks.TNT.defaultBlockState(),(net.minecraft.client.renderer.block.model.BlockDisplayContext)get(net.minecraft.client.renderer.entity.TntRenderer.class,"BLOCK_DISPLAY_CONTEXT"));
   if(s instanceof ItemFrameRenderState frame)assets.blocks.updateForItemFrame(frame.frameModel,id.equals("glow_item_frame"),false);
   if(s instanceof SnowGolemRenderState snow)assets.blocks.update(snow.headBlock,net.minecraft.world.level.block.Blocks.CARVED_PUMPKIN.defaultBlockState(),net.minecraft.client.renderer.block.model.BlockDisplayContext.create());
   if(s instanceof MushroomCowRenderState mushroom)assets.blocks.update(mushroom.mushroomModel,net.minecraft.world.level.block.Blocks.RED_MUSHROOM.defaultBlockState(),net.minecraft.client.renderer.block.model.BlockDisplayContext.create());
   if(s instanceof ThrownItemRenderState thrown)assets.update(thrown.item,"fire_charge",net.minecraft.world.item.ItemDisplayContext.GROUND);
   if(s instanceof FireworkRocketRenderState firework)assets.update(firework.item,"firework_rocket",net.minecraft.world.item.ItemDisplayContext.GROUND);
  }
  return s;
 }
 static net.minecraft.world.item.ItemStack stack(String item){return new net.minecraft.world.item.ItemStack(BuiltInRegistries.ITEM.getValue(Identifier.withDefaultNamespace(item)));}
 static void marker(net.minecraft.client.renderer.item.ItemStackRenderState state,String slot,net.minecraft.world.item.ItemDisplayContext context)throws Exception {
  state.clear();set(state,"displayContext",context);
  state.newLayer().setupSpecialModel(new net.minecraft.client.renderer.special.SpecialModelRenderer<String>() {
   public void submit(String key,PoseStack pose,SubmitNodeCollector collector,int light,int overlay,boolean foil,int outline){
    active.attachments.put(key,Map.of("matrix",new org.joml.Matrix4f(pose.last().pose()).translate(.5f,.5f,.5f).get(new float[16]),"context",context.name()));
   }
   public void getExtents(java.util.function.Consumer<org.joml.Vector3fc> c){c.accept(new org.joml.Vector3f());}
   public String extractArgument(net.minecraft.world.item.ItemStack item){return slot;}
  },slot);
 }
 static void pose(EntityRenderState s,boolean riding,int held)throws Exception {
  if(s instanceof HumanoidRenderState h)h.isPassenger=riding;
  if(s instanceof IllagerRenderState h)h.isRiding=riding;
  if(s instanceof ArmedEntityRenderState a){
   a.mainArm=HumanoidArm.RIGHT;a.attackArm=HumanoidArm.RIGHT;
   a.rightHandItemStack=(held&1)!=0?stack("diamond_sword"):net.minecraft.world.item.ItemStack.EMPTY;
   a.leftHandItemStack=(held&2)!=0?stack("shield"):net.minecraft.world.item.ItemStack.EMPTY;
   a.rightArmPose=(held&1)!=0?net.minecraft.client.model.HumanoidModel.ArmPose.ITEM:net.minecraft.client.model.HumanoidModel.ArmPose.EMPTY;
   a.leftArmPose=(held&2)!=0?net.minecraft.client.model.HumanoidModel.ArmPose.ITEM:net.minecraft.client.model.HumanoidModel.ArmPose.EMPTY;
   if((held&1)!=0)marker(a.rightHandItemState,"mainhand",net.minecraft.world.item.ItemDisplayContext.THIRD_PERSON_RIGHT_HAND);
   if((held&2)!=0)marker(a.leftHandItemState,"offhand",net.minecraft.world.item.ItemDisplayContext.THIRD_PERSON_LEFT_HAND);
  }
  if(s instanceof HoldingEntityRenderState h && (held&1)!=0)marker(h.heldItem,"mainhand",net.minecraft.world.item.ItemDisplayContext.GROUND);
  if(s instanceof WitchRenderState w)w.isHoldingItem=(held&1)!=0;
  if(s instanceof AllayRenderState a)a.holdingAnimationProgress=held==0?0:1;
 }
 static void gear(EntityRenderState s,String slot,String item)throws Exception {
  var stack=stack(item);
  if(s instanceof HumanoidRenderState h)set(h,Map.of("head","headEquipment","chest","chestEquipment","legs","legsEquipment","feet","feetEquipment").get(slot),stack);
  if(slot.equals("head") && s instanceof LivingEntityRenderState l) {
   if(stack.getItem() instanceof net.minecraft.world.item.BlockItem b && b.getBlock() instanceof net.minecraft.world.level.block.AbstractSkullBlock skull)l.wornHeadType=skull.getType();
   else if(!net.minecraft.client.renderer.entity.layers.HumanoidArmorLayer.shouldRender(stack,EquipmentSlot.HEAD))assets.update(l.headItem,item,net.minecraft.world.item.ItemDisplayContext.HEAD);
  }
 }
 static Capture capture(EntityRenderer renderer,EntityRenderState state)throws Exception {var c=new Capture();active=c;renderer.submit(state,new PoseStack(),c.proxy,new CameraRenderState());if(!c.unsupported.isEmpty())throw new IllegalStateException("Unhandled submissions: "+c.unsupported);return c;}
 static String mesh(Object data)throws Exception {
  String json=encode(data);String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.getBytes(java.nio.charset.StandardCharsets.UTF_8))).substring(0,24);
  if(written.add(hash))Files.writeString(output.resolve("meshes/"+hash+".json"),json);return hash;
 }
 static List<String> refs(Capture c)throws Exception{List<String> refs=new ArrayList<>();for(Object m:c.meshes)refs.add(mesh(m));return refs;}
 public static void main(String[] args)throws Exception{
  net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();
  var lookup=net.minecraft.data.registries.VanillaRegistries.createLookup();
  for(var pending:BuiltInRegistries.DATA_COMPONENT_INITIALIZERS.build(lookup))pending.apply();
  var u=Class.forName("sun.misc.Unsafe");var uf=u.getDeclaredField("theUnsafe");uf.setAccessible(true);unsafe=uf.get(null);allocate=u.getMethod("allocateInstance",Class.class);
  var context=(EntityRendererProvider.Context)allocate.invoke(unsafe,EntityRendererProvider.Context.class);set(context,"modelSet",EntityModelSet.vanilla());
  set(context,"resourceManager",Proxy.newProxyInstance(CaptureScenes.class.getClassLoader(),new Class[]{net.minecraft.server.packs.resources.ResourceManager.class},(proxy,method,values)->{if(method.getReturnType()==Optional.class)return Optional.empty();if(method.getReturnType()==Set.class)return Set.of("minecraft");if(method.getReturnType()==List.class)return List.of();if(method.getReturnType()==Map.class)return Map.of();if(method.isDefault())return InvocationHandler.invokeDefault(proxy,method,values);return null;}));
  var providers=(Map<EntityType<?>,EntityRendererProvider<?>>)get(EntityRenderers.class,"PROVIDERS");
  var catalog=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();defaults=JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonObject();
  assets=new VanillaAssets(args[3],catalog);elytraRest=assets.models.bakeLayer(ModelLayers.ELYTRA).getChild("left_wing").getInitialPose();set(context,"equipmentRenderer",new net.minecraft.client.renderer.entity.layers.EquipmentLayerRenderer(assets.equipment(),null));set(context,"itemModelResolver",assets.resolver);set(context,"blockModelResolver",assets.blocks);
  output=Path.of(args[2]);for(String dir:List.of("entities","items","meshes","textures"))Files.createDirectories(output.resolve(dir));Map<String,Object> report=new TreeMap<>();
  Set<String> babies=new HashSet<>();for(var id:catalog.getAsJsonArray("babyEntities"))babies.add(id.getAsString());
  for(var v:catalog.getAsJsonArray("entities")){
   String id=v.getAsString();try{
    var type=BuiltInRegistries.ENTITY_TYPE.getValue(Identifier.withDefaultNamespace(id.equals("boat")?"oak_boat":id));if(type==null)throw new Exception("Unknown entity type");
    EntityRenderer renderer=providers.get(type).create(context);Map<String,Object> poses=new TreeMap<>();int visibleGear=0;
    for(int age=0;age<(babies.contains(id)?2:1);age++)for(int riding=0;riding<2;riding++)for(int held=0;held<4;held++)for(int crossbow=0;crossbow<(id.equals("pillager")&&held>0?2:1);crossbow++){
     boolean baby=age==1;var state=state(renderer,type,id,baby);pose(state,riding==1,held);if(crossbow==1)((IllagerRenderState)state).armPose=net.minecraft.world.entity.monster.illager.AbstractIllager.IllagerArmPose.CROSSBOW_HOLD;var base=capture(renderer,state);var body=refs(base);Map<String,Object> equipment=new TreeMap<>();
     for(var sl:catalog.getAsJsonArray("slots")){
      var slot=sl.getAsJsonObject();String key=slot.get("key").getAsString();if(key.endsWith("hand"))continue;Map<String,Object> variants=new TreeMap<>();
      if(state instanceof LivingEntityRenderState)for(var it:slot.getAsJsonArray("items")){
       String item=it.getAsString();var dressed=state(renderer,type,id,baby);pose(dressed,riding==1,held);if(crossbow==1)((IllagerRenderState)dressed).armPose=net.minecraft.world.entity.monster.illager.AbstractIllager.IllagerArmPose.CROSSBOW_HOLD;gear(dressed,key,item);var captured=capture(renderer,dressed);var all=refs(captured);var extra=new ArrayList<>(all);for(String ref:body)extra.remove(ref);
       if(!extra.isEmpty()){variants.put(item,extra);visibleGear++;}
      }
      equipment.put(key,variants);
     }
     poses.put((baby?"baby-":"")+(riding==1?"riding":"standing")+held+(crossbow==1?"-crossbow":""),Map.of("body",body,"attachments",base.attachments,"equipment",equipment));
    }
    var dimensions=type.getDimensions();float defaultScale=net.minecraft.world.entity.ai.attributes.DefaultAttributes.hasSupplier(type)?(float)net.minecraft.world.entity.ai.attributes.DefaultAttributes.getSupplier((EntityType)type).getValue(net.minecraft.world.entity.ai.attributes.Attributes.SCALE):1;var passenger=dimensions.attachments().get(net.minecraft.world.entity.EntityAttachment.PASSENGER,0,0);var vehicle=dimensions.attachments().get(net.minecraft.world.entity.EntityAttachment.VEHICLE,0,0);
    Files.writeString(output.resolve("entities/"+id+".json"),encode(Map.of("format",3,"minecraft","26.1.2","poses",poses,"passenger",List.of(passenger.x,passenger.y,passenger.z),"vehicle",List.of(vehicle.x,vehicle.y,vehicle.z),"height",dimensions.height(),"defaultScale",defaultScale,"billboard",renderer instanceof ThrownItemRenderer || renderer instanceof FireworkEntityRenderer || renderer instanceof ExperienceOrbRenderer)));
    report.put(id,Map.of("poses",poses.size(),"equipmentVariants",visibleGear,"renderer",renderer.getClass().getName()));System.out.println("Entity "+id);
   }catch(Throwable ex){while(ex.getCause()!=null)ex=ex.getCause();report.put(id,Map.of("error",ex.toString()));System.out.println(id+": "+ex);}
  }
  Map<String,Object> itemReport=new TreeMap<>();Set<String> items=new TreeSet<>();for(var slot:catalog.getAsJsonArray("slots"))for(var item:slot.getAsJsonObject().getAsJsonArray("items"))items.add(item.getAsString());
  for(String item:items)try {
   Map<String,Object> contexts=new TreeMap<>();
   for(var display:List.of(net.minecraft.world.item.ItemDisplayContext.THIRD_PERSON_RIGHT_HAND,net.minecraft.world.item.ItemDisplayContext.THIRD_PERSON_LEFT_HAND,net.minecraft.world.item.ItemDisplayContext.GROUND)){
    var state=new net.minecraft.client.renderer.item.ItemStackRenderState();assets.update(state,item,display);var c=new Capture();active=c;state.submit(new PoseStack(),c.proxy,15728880,655360,0);if(!c.unsupported.isEmpty())throw new Exception(c.unsupported.toString());contexts.put(display.name(),refs(c));
   }
   Files.writeString(output.resolve("items/"+item+".json"),encode(contexts));itemReport.put(item,Map.of("contexts",contexts.size()));
  }catch(Throwable ex){itemReport.put(item,Map.of("error",ex.toString()));System.out.println(item+": "+ex);}
  for(String path:assets.palettes.keySet())if(path.startsWith("trims/entity/"))textures.add("minecraft:textures/"+path+".png");
  for(var entry:Collections.list(assets.jar.entries())){String name=entry.getName();if(name.endsWith(".png")&&(name.startsWith("assets/minecraft/textures/entity/banner/")||name.startsWith("assets/minecraft/textures/entity/shield/")||name.startsWith("assets/minecraft/textures/entity/horse/horse_")))textures.add("minecraft:"+name.substring("assets/minecraft/".length()));}
  for(String texture:textures){String path=texture.replace("minecraft:","");if(!path.startsWith("textures/")||!path.endsWith(".png"))throw new IllegalStateException("Texture "+texture);Path target=output.resolve(path);Files.createDirectories(target.getParent());try(var image=assets.image(path.substring(9,path.length()-4))){image.writeToFile(target);}}
  Files.writeString(output.resolve("report.json"),encode(Map.of("entities",report,"items",itemReport,"textures",textures.size(),"meshes",written.size())));System.out.println("Captured "+report.size()+" entity records, "+itemReport.size()+" items");
 }
}
