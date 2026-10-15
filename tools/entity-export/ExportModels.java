import com.google.gson.GsonBuilder;
import net.minecraft.client.model.geom.*;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;

/** Preparation only: calls the client's own baker, never starts a renderer or a window. */
public class ExportModels {
    static Object privateField(Object object, String name) throws Exception {
        Field field = object.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(object);
    }
    static Map<String,Object> part(ModelPart p) throws Exception {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("pivot", new float[]{p.x,p.y,p.z});
        result.put("rotation", new float[]{p.xRot,p.yRot,p.zRot});
        result.put("scale", new float[]{p.xScale,p.yScale,p.zScale});
        result.put("visible", p.visible);
        List<Object> faces = new ArrayList<>();
        for (var cube : (List<ModelPart.Cube>)privateField(p,"cubes")) {
            for (var polygon : cube.polygons) {
                List<Object> vertices = new ArrayList<>();
                for (var v : polygon.vertices()) vertices.add(new float[]{v.x(),v.y(),v.z(),v.u(),v.v()});
                var n = polygon.normal();
                faces.add(Map.of("vertices",vertices,"normal",new float[]{n.x(),n.y(),n.z()}));
            }
        }
        result.put("faces",faces);
        Map<String,Object> children = new TreeMap<>();
        for (var entry : ((Map<String,ModelPart>)privateField(p,"children")).entrySet()) children.put(entry.getKey(),part(entry.getValue()));
        result.put("children",children);
        return result;
    }
    static String modelClass(String id) {
        return switch(id) {
            case "zombie" -> "monster.zombie.ZombieModel";
            case "zombie_baby" -> "monster.zombie.BabyZombieModel";
            case "skeleton" -> "monster.skeleton.SkeletonModel";
            case "horse" -> "animal.equine.HorseModel";
            case "horse_baby" -> "animal.equine.BabyHorseModel";
            case "villager" -> "npc.VillagerModel";
            case "villager_baby" -> "npc.BabyVillagerModel";
            default -> "monster.ravager.RavagerModel";
        };
    }
    static Map<String,Object> transforms(ModelPart p, String path, Map<String,Object> out) throws Exception {
        out.put(path, Map.of("pivot",new float[]{p.x,p.y,p.z},"rotation",new float[]{p.xRot,p.yRot,p.zRot},"scale",new float[]{p.xScale,p.yScale,p.zScale}));
        for(var entry : ((Map<String,ModelPart>)privateField(p,"children")).entrySet()) transforms(entry.getValue(),path+"/"+entry.getKey(),out);
        return out;
    }
    static Map<String,Object> poses(String id, ModelPart root) throws Exception {
        var model = Class.forName("net.minecraft.client.model."+modelClass(id)).getConstructor(ModelPart.class).newInstance(root);
        var method = Arrays.stream(model.getClass().getMethods()).filter(m -> m.getName().equals("setupAnim") && !m.isBridge() && m.getParameterCount()==1 && m.getParameterTypes()[0]!=Object.class).findFirst().orElseThrow();
        Map<String,Object> poses = new TreeMap<>();
        for(boolean riding : new boolean[]{false,true}) for(int held=0;held<4;held++) {
            var state = (net.minecraft.client.renderer.entity.state.LivingEntityRenderState) method.getParameterTypes()[0].getConstructor().newInstance();
            state.isBaby = id.endsWith("_baby"); state.ageScale = 1; state.scale = 1;
            if(state instanceof net.minecraft.client.renderer.entity.state.HumanoidRenderState h) {
                h.isPassenger = riding;
                h.rightArmPose = (held&1)!=0 ? net.minecraft.client.model.HumanoidModel.ArmPose.ITEM : net.minecraft.client.model.HumanoidModel.ArmPose.EMPTY;
                h.leftArmPose = (held&2)!=0 ? net.minecraft.client.model.HumanoidModel.ArmPose.ITEM : net.minecraft.client.model.HumanoidModel.ArmPose.EMPTY;
            }
            method.invoke(model,state);
            Map<String,Object> pose = new LinkedHashMap<>();
            pose.put("parts", transforms(root,"root",new TreeMap<>()));
            if(model instanceof net.minecraft.client.model.ArmedModel armed) {
                Map<String,Object> hands = new TreeMap<>();
                for(var arm : net.minecraft.world.entity.HumanoidArm.values()) {
                    var stack = new com.mojang.blaze3d.vertex.PoseStack();
                    armed.translateToHand(state,arm,stack);
                    stack.mulPose(com.mojang.math.Axis.XP.rotationDegrees(-90));
                    stack.mulPose(com.mojang.math.Axis.YP.rotationDegrees(180));
                    stack.translate((arm==net.minecraft.world.entity.HumanoidArm.LEFT?-1:1)*(state.isBaby?0:1)/16f,(state.isBaby?1:2)/16f,(state.isBaby?-4.5f:-10)/16f);
                    hands.put(arm==net.minecraft.world.entity.HumanoidArm.LEFT?"offhand":"mainhand", stack.last().pose().get(new float[16]));
                }
                pose.put("hands",hands);
            }
            poses.put((riding?"riding":"standing")+held,pose);
        }
        return poses;
    }
    public static void main(String[] args) throws Exception {
        net.minecraft.SharedConstants.tryDetectVersion();
        net.minecraft.server.Bootstrap.bootStrap();
        var roots = LayerDefinitions.createRoots();
        var out = Path.of(args[0]); Files.createDirectories(out);
        var gson = new GsonBuilder().disableHtmlEscaping().create();
        for (var entry : roots.entrySet()) {
            String id = entry.getKey().model().getPath();
            if (!Set.of("zombie","zombie_baby","skeleton","horse","horse_baby","villager","villager_baby","ravager").contains(id)) continue;
            String layer = entry.getKey().layer();
            System.out.println(id + " / " + layer);
            var root = entry.getValue().bakeRoot();
            Map<String,Object> data = new LinkedHashMap<>();
            data.put("format",1); data.put("minecraft","26.1.2"); data.put("source",entry.getKey().toString()); data.put("root",part(root));
            if(layer.equals("main")) data.put("poses",poses(id,root));
            Files.writeString(out.resolve(id+"--"+layer.replace('/','_')+".json"),gson.toJson(data));
        }
    }
}
